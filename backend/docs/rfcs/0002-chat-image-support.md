# RFC 0002: Chat Image Input Support for Gemini

- Status: Done
- Date: 2026-03-12
- Owners: Backend, Frontend

## Summary

Add image input support to the existing chat experience so a user can send one or more photos together with text and receive a text response from Gemini.

This RFC recommends a phased implementation with three key architectural decisions:

1. Keep the application-owned chat orchestration in `src/chat/service.py`.
2. Add first-class multimodal message parts and attachment persistence instead of forcing images into the current `content: str` shape.
3. Use the official Google GenAI SDK and Gemini Files API for chat image inputs instead of extending the current LangChain text-only adapter.

Phase 1 is image input only. Assistant-generated images are out of scope.

## Current State Evaluation

### What exists today

The current chat stack is intentionally thin and text-only:

- `backend/src/chat/router.py` accepts `ChatRequest(messages, conversation_id)` and passes plain `role/content` dictionaries to the service.
- `backend/src/chat/schemas.py` defines `ChatMessage` as `role: str` and `content: str`.
- `backend/src/chat/models.py` persists `ConversationMessage` rows with only `role` and `content`.
- `backend/src/chat/service.py` adds a system prompt, replays prior text turns, runs Gemini tool-calling, and stores user/assistant text messages.
- `backend/src/chat/llm_client.py` normalizes provider interaction behind `LLMClient`, but still converts only string content into `HumanMessage` / `AIMessage` / `ToolMessage`.
- `pe-be-tracker-frontend/src/features/chat/pages/ChatPage.tsx` renders and sends only text messages.

There is also a separate image-generation helper in `backend/src/genai/google_images.py`, but it is not part of chat. It targets generated exercise illustrations, not user-provided chat images.

### Strengths of the current design

- The app already has a useful provider boundary (`LLMClient`), so chat business logic is not fully locked to Gemini response objects.
- Tool execution is server-side and already isolated from the provider adapter.
- Conversation persistence already exists, so multimodal history can be added without inventing a second chat system.
- Langfuse tracing is already present and can be extended to include multimodal metadata.

### Gaps relevant to image support

1. The request contract is text-only.

`ChatRequest` and `ChatMessage` cannot represent image parts, uploaded file references, MIME types, or ordered multimodal content.

2. The persistence model is text-only.

`conversation_messages.content` is insufficient as the canonical source of truth for multimodal turns. Flattening images into text summaries would lose fidelity and make replay unreliable.

3. The provider adapter is text-first.

`GeminiLangChainClient._to_langchain_messages()` only maps strings. There is no representation for `inline_data`, `file_data`, or ordered parts.

4. The frontend has no attachment lifecycle.

There is no file picker, no upload endpoint, no preview/removal UX, no upload progress, and no server-issued attachment IDs.

5. Observability is incomplete for multimodal cost and safety.

The current flow does not record `usage_metadata`, modality token counts, attachment metadata, or Gemini safety feedback.

6. The default production model choice is stale.

Chat currently defaults to `gemini-2.5-flash-preview-09-2025`. That is a preview model string, not the stable `gemini-2.5-flash` alias. This is acceptable for experimentation but is not the best default for production chat traffic.

### Conclusion

The current chat implementation is a good base for multimodal support, but only if we promote chat messages from plain text blobs to structured parts. The existing adapter boundary makes the provider migration tractable, but the current API and database schema do not.

## Goals

- Let users send one or more images with a text prompt in chat.
- Preserve conversation history in a replayable multimodal format.
- Keep backend-owned tool calling and conversation persistence.
- Stay compatible with authenticated server-side Gemini usage.
- Reuse uploaded images efficiently across retries and conversation reloads.
- Improve observability for token usage, safety blocks, and attachment failures.

## Non-Goals

- Assistant image generation in chat
- Anonymous image upload support
- OCR-specific product features beyond what Gemini already provides
- Replacing Langfuse
- Reworking the workout tools in this RFC
- Full live streaming or voice/video chat in this RFC

## Decision

### 1. Add multimodal message parts

Introduce an internal message-part model for chat.

Recommended shape:

- `ConversationTurn`
  - `role`
  - `parts[]`
- `ConversationPart`
  - `type`: `text` | `image`
  - `text`
  - `attachment_id`
  - `mime_type`
  - `storage_url` or provider file reference at runtime only
  - `order_index`

The existing `conversation_messages.content` field should remain temporarily as a denormalized text summary for compatibility, but it should stop being treated as the canonical replay format for new multimodal turns.

### 2. Add server-managed chat attachments

Add a dedicated attachment concept and upload endpoint.

Recommended API:

- `POST /api/v1/chat/attachments`
  - multipart upload
  - validates auth, MIME type, size, and image decodability
  - stores original bytes in app-controlled storage
  - optionally uploads to Gemini Files API lazily on first model call
  - returns `attachment_id`, `mime_type`, `size_bytes`, `width`, `height`, and preview URL if needed

- `POST /api/v1/chat`
  - backward-compatible text-only payload still allowed
  - new message payload supports ordered `parts`

Recommended request shape:

```json
{
  "messages": [
    {
      "role": "user",
      "parts": [
        { "type": "image", "attachment_id": "att_123" },
        { "type": "text", "text": "How is my squat depth here?" }
      ]
    }
  ],
  "conversation_id": 42
}
```

### 3. Persist attachments and message parts explicitly

Recommended schema additions:

- `chat_attachments`
  - `id`
  - `user_id`
  - `storage_key`
  - `mime_type`
  - `size_bytes`
  - `width`
  - `height`
  - `sha256`
  - `status`
  - `provider_file_name`
  - `provider_file_uri`
  - `provider_file_expires_at`
  - `created_at`

- `conversation_message_parts`
  - `id`
  - `conversation_message_id`
  - `order_index`
  - `part_type`
  - `text_content`
  - `attachment_id`
  - `created_at`

Why this shape:

- It preserves multimodal turn order.
- It avoids embedding provider-specific URIs as the only durable source of truth.
- It lets the backend re-upload to Gemini when provider file handles expire.
- It keeps the app free to move storage backends later.

### 4. Move the multimodal provider path to the official Google GenAI SDK

For image-input chat, use the official `google-genai` SDK instead of extending the current LangChain adapter.

Rationale:

- Gemini’s official documentation now recommends the Google GenAI SDK for production use.
- The current LangChain integration is workable for text tool-calling, but it is not the best foundation for Files API management, multimodal parts, safety metadata, and usage metadata.
- The repo already has an internal `LLMClient` boundary from RFC 0001, so this migration can happen behind that interface.

Recommended implementation path:

- Keep `LLMClient` as the application boundary.
- Add a new Gemini provider implementation based on `google-genai`.
- Make that implementation the default for chat once text and multimodal parity are proven.
- Retire the LangChain-backed adapter after parity and tests are complete.

### 5. Keep text chat and image chat on the same main model

Use `gemini-2.5-flash` for the main chat assistant.

Reasons:

- It supports text + image input and text output.
- It supports function calling and structured outputs.
- It is the stable production alias.

Do not route image-understanding chat turns to `gemini-2.5-flash-image`. That model is for image generation/editing workflows and does not support function calling, which would complicate the existing server-side tools model.

### 6. Preserve server-side tool calling

The model should continue to reason over chat history and call application-owned tools when needed. Image input does not change that rule.

If the user sends an image plus a workout question, the model should still be able to:

- answer directly
- ask a follow-up question
- call a domain tool when the request depends on internal user workout data

### 7. Add safety, token, and failure instrumentation

Store or emit the following from each Gemini response when available:

- selected model name
- prompt token count
- candidate token count
- total token count
- modality token details when available
- prompt block reason
- candidate finish reason
- safety ratings
- attachment count and MIME types

This is necessary to understand cost, failures, and image-related moderation behavior.

## Detailed Design

### Backend API

#### Chat attachments endpoint

`POST /api/v1/chat/attachments`

Behavior:

- Require authenticated user.
- Accept only supported image MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif`.
- Enforce server-side size limits.
- Verify image decodes successfully and normalize metadata.
- Store bytes in app-controlled object storage or disk-backed media storage.
- Return attachment metadata for inclusion in the next chat request.

#### Chat request/response

Add a v2-compatible request schema while preserving the current simple case:

- allow `content` for legacy text-only clients
- allow `parts[]` for new multimodal clients
- reject requests that send neither text nor image parts

The response can remain text-only in Phase 1:

```json
{
  "message": "Your knees track well here, but the photo angle makes depth hard to confirm.",
  "conversation_id": 42
}
```

If the frontend later needs assistant attachments, that should be a separate RFC.

### Provider flow

Recommended request assembly for a user turn with images:

1. Resolve `attachment_id` values to attachment records.
2. Ensure each attachment has a valid Gemini file reference.
3. Build Gemini `parts` in order, with image parts before the text question for single-turn image analysis prompts.
4. Send the full conversation history as alternating `user` / `model` content.
5. Include system instruction through Gemini config, not as a fake user turn.
6. Capture `usage_metadata` and safety feedback.

### Attachment lifecycle

Recommended lifecycle:

1. Frontend uploads image and gets `attachment_id`.
2. Frontend sends chat message with ordered parts referencing that ID.
3. Backend validates ownership and status.
4. Backend uploads to Gemini Files API only if there is no active provider file reference.
5. Backend calls Gemini with `file_data` / SDK file parts.
6. Backend persists the multimodal turn and assistant text reply.
7. A cleanup job removes expired orphaned attachments and refreshes provider-file references lazily.

### Frontend UX

Phase 1 UI changes for `ChatPage.tsx`:

- Add image picker from device files.
- Show local preview chips/cards before send.
- Allow removing an attachment before submit.
- Disable send while uploads are incomplete.
- Show upload-specific error states separately from model errors.
- Render prior user images inside the conversation history.
- Keep assistant responses as Markdown text.

Recommended UX constraints:

- Maximum 3 to 5 images per turn initially.
- Show file type and size validation before upload.
- Compress oversized images client-side only if the quality loss is acceptable; otherwise reject clearly.

## Options Considered

### Option A: Keep the current text schema and embed image URLs or base64 into `content`

Pros:

- Minimal schema change
- Fastest short-term patch

Cons:

- Loses ordered multimodal structure
- Poor replay semantics
- Hard to validate ownership and MIME type
- Easy to exceed request size limits
- Forces the provider adapter to parse application-specific conventions from strings

Decision:

- Rejected

### Option B: Keep LangChain and extend the existing adapter for multimodal support

Pros:

- Smaller immediate provider change
- May preserve some current tool-calling behavior

Cons:

- Adds multimodal complexity on top of an adapter path that is already not the recommended Gemini SDK
- Makes Files API handling and provider metadata capture more awkward
- Delays migration away from a less capable integration path

Decision:

- Rejected as the primary direction

### Option C: Use the official Google GenAI SDK behind `LLMClient`

Pros:

- Matches current Google guidance
- Best support for Files API and multimodal parts
- Better access to usage and safety metadata
- Cleanest long-term base for image chat

Cons:

- Requires provider migration work
- Requires text parity testing before cutover

Decision:

- Accepted

## Rollout Plan

### Phase 0: Foundation

- Add new chat attachment and message-part schemas.
- Add defensive Alembic migration(s) for new tables.
- Keep the legacy text-only path working.

### Phase 1: Backend multimodal MVP

- Add attachment upload endpoint.
- Add storage adapter for chat images.
- Add Gemini Files API integration and provider-file caching.
- Add GenAI SDK-backed `LLMClient`.
- Persist multimodal turns.

### Phase 2: Frontend MVP

- Add attach/remove/preview flow.
- Send multimodal chat payloads.
- Render user image history.

### Phase 3: Hardening

- Add streaming if desired.
- Add token and safety dashboards in Langfuse or app logs.
- Add cleanup job for orphaned or expired provider references.
- Make the stable SDK-backed provider the only chat provider.

## Testing Strategy

### Backend

- Schema tests for legacy text-only and new `parts[]` payloads
- Attachment authorization tests
- MIME type and size validation tests
- Service tests for multimodal history replay
- Provider adapter tests for image parts, file references, and tool-calling coexistence
- Persistence tests for `conversation_message_parts`

### Frontend

- Component tests for image attachment UX
- Mutation tests for upload failure and chat failure paths
- Rendering tests for prior multimodal history

### Manual / staging

- single image + text question
- multiple images + comparison question
- retrying the same image across multiple turns
- blocked/unsafe input handling
- expired provider file reference refresh

## Risks

- Storage complexity increases because the app must own original bytes and not rely only on Gemini file URIs.
- Multimodal history can increase token cost significantly if prior images are replayed too aggressively.
- Image uploads introduce new privacy and abuse surfaces that text-only chat does not have.
- The current frontend sends full message history each turn; this will become more expensive with images and may require history truncation or server-owned replay logic sooner.

## Open Questions

1. Should attachments be stored in S3/GCS immediately, or is local disk acceptable for the first internal release?
2. Do we want to keep the client-owned full-history request pattern, or move to server-owned history assembly as part of the same change?
3. Do we want EXIF stripping and image recompression on upload, or only validation in Phase 1?
4. Should previous-image replay be automatic for all turns, or explicit only when the user references earlier photos?

## Gemini Best Practices Check

This RFC was checked on 2026-03-12 against current official Gemini documentation.

### Aligned

1. Use the official Google GenAI SDK.

The RFC recommends replacing the multimodal chat provider path with the official SDK, which matches Google’s current recommendation for production Gemini integrations.

2. Use the Files API for reusable or larger images.

The RFC explicitly uses Gemini Files API instead of inline base64 for the normal chat attachment flow. This matches current guidance that inline data is for smaller requests and Files API is better for larger files or reused media.

3. Treat image input as first-class multimodal content.

The RFC models ordered message parts instead of forcing images into text fields. This matches Gemini’s multimodal `contents/parts` model.

4. Keep system instructions explicit.

The RFC recommends passing the system prompt through Gemini config rather than burying it in faux conversation turns.

5. Capture usage metadata and safety feedback.

The RFC requires `usage_metadata`, safety ratings, prompt block reasons, and finish reasons to be recorded, which aligns with Gemini guidance for token awareness and safe deployment.

6. Use a stable production model alias.

The RFC recommends `gemini-2.5-flash` rather than keeping the preview alias as the default production model.

### Adjustments made after the doc check

1. The RFC prefers Files API by default for image chat, not only as an optimization.

This was strengthened after reviewing current Gemini guidance on request-size limits and repeated file reuse.

2. The RFC explicitly recommends ordering image parts before the text question for single-turn image analysis prompts.

This was added to match Gemini’s current image-understanding guidance.

3. The RFC now calls out `usage_metadata` and multimodal token counting as first-class observability requirements.

This was added because multimodal inputs materially affect latency and cost.

### Remaining gaps versus ideal Gemini usage

1. Streaming is deferred.

Gemini supports streaming, and it is useful for chat UX, but this RFC keeps it out of the first implementation to reduce scope.

2. Structured outputs are not part of the main user-facing reply path.

That is acceptable for conversational answers, but image-specific extraction flows may later benefit from schema-constrained JSON for specialized features.

3. Safety thresholds are not customized yet.

The RFC currently recommends instrumentation first and leaves per-category threshold tuning to rollout validation, which is safer than changing defaults blindly.

## References

- Google AI for Developers, Gemini API libraries: https://ai.google.dev/gemini-api/docs/libraries
- Google AI for Developers, Image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
- Google AI for Developers, Text generation and system instructions: https://ai.google.dev/gemini-api/docs/text-generation
- Google AI for Developers, Models: https://ai.google.dev/gemini-api/docs/models
- Google AI for Developers, Gemini API reference: https://ai.google.dev/api
- Google AI for Developers, Understand and count tokens: https://ai.google.dev/gemini-api/docs/tokens
- Google AI for Developers, Safety settings: https://ai.google.dev/gemini-api/docs/safety-settings
- Google AI for Developers, Safety guidance: https://ai.google.dev/gemini-api/docs/safety-guidance
- Google AI for Developers, Structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
