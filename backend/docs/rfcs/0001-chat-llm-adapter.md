# RFC 0001: Provider-Normalized Chat Tool Calling

- Status: Accepted
- Date: 2026-03-10
- Owners: Backend

## Summary

The chat backend now uses an internal LLM adapter boundary instead of letting provider- or framework-specific tool-calling objects flow directly through the application service layer.

The change introduces:

- an internal conversation model
- an internal tool definition and tool-call model
- a thin `LLMClient` interface
- a Gemini-backed implementation that normalizes provider output into internal types

This keeps the current Gemini integration working while reducing coupling in [`src/chat/service.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/src/chat/service.py) and making future provider swaps or orchestration changes cheaper.

## Context

Before this change, the chat stack in [`src/chat/service.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/src/chat/service.py) directly depended on:

- `ChatGoogleGenerativeAI`
- LangChain message classes such as `HumanMessage`, `AIMessage`, `SystemMessage`, and `ToolMessage`
- LangChain `Tool`
- Gemini/LangChain-specific tool-call response shapes

That had a few concrete costs:

1. Provider and framework details leaked into core application code.
2. Tool argument repair logic lived in the service layer instead of at the provider boundary.
3. Tests had to mock LangChain/Gemini behavior directly.
4. Swapping providers would require editing the service logic instead of only an adapter.
5. It was harder to reason about which parts of the chat system were business logic versus transport/framework glue.

The specific pain point was not only provider lock-in. It was split lock-in:

- business logic was coupled to Gemini behavior
- business logic was also coupled to LangChain translation behavior

That is worse than having a single explicit boundary.

## Goals

- Keep chat business logic independent from provider response shapes.
- Keep tool execution on the server.
- Preserve the existing external `/chat` API contract.
- Make the provider boundary injectable for testing.
- Reduce the amount of LangChain/Gemini-specific logic in `ChatService`.

## Non-Goals

- Replacing Gemini in this RFC
- Removing LangChain entirely in this RFC
- Implementing MCP
- Changing the frontend chat API
- Moving to server-owned conversation state in this RFC

## Decision

We introduced a small internal contract in [`src/chat/llm_client.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/src/chat/llm_client.py):

- `ConversationMessage`
- `ToolCall`
- `LLMResponse`
- `ToolDefinition`
- `LLMClient`

`ChatService` now depends on `LLMClient` and `ToolDefinition`, not on LangChain or Gemini message objects directly.

The current provider implementation is `GeminiLangChainClient`, which does two things:

1. Converts internal `ConversationMessage` values into the message types required by the Gemini/LangChain integration.
2. Converts Gemini/LangChain responses back into internal `LLMResponse` and `ToolCall` values.

This means the current runtime path is:

`ChatService -> LLMClient -> GeminiLangChainClient -> Gemini via LangChain`

not:

`ChatService -> Gemini/LangChain directly`

## Why This Was Implemented

### 1. Explicit boundary ownership

The chat service should own:

- system prompt selection
- persistence
- tool registry
- tool execution loop
- final response selection

It should not own:

- provider response parsing
- framework message translation
- provider-specific tool-call shape repair

Those now live in the adapter layer.

### 2. Lower migration cost

If the team later wants:

- Gemini native SDK instead of LangChain
- OpenAI
- Anthropic
- a mocked local test client

the target change is the `LLMClient` implementation, not the application service.

### 3. Better tests

Tests can now inject a fake `LLMClient` and return normalized `LLMResponse` values.

That is simpler than mocking:

- LangChain tool wrappers
- Gemini response objects
- message-class conversions

### 4. Cleaner tool contracts

Tool argument normalization now belongs to `ToolDefinition`, where it can be typed and validated with Pydantic schemas.

This is a better location than the middle of the chat orchestration loop.

### 5. Reduced accidental complexity

This repo already uses Langfuse and application-level tracing. Adding more framework or protocol machinery without a clear boundary would increase complexity quickly.

The chosen design tries to keep the architecture small:

- one application service
- one adapter interface
- one provider implementation

## Detailed Design

### Internal types

`ConversationMessage` is the canonical chat message shape inside the backend.

It supports:

- `system`
- `user`
- `assistant`
- `tool`

`ToolCall` is the canonical representation of a requested tool invocation:

- `call_id`
- `name`
- `args`

`LLMResponse` wraps the normalized assistant message and any tool calls emitted by the provider.

### Tool definitions

`ToolDefinition` is the application-owned tool contract.

It contains:

- `name`
- `description`
- async `handler`
- optional `args_model`

This lets the backend keep its own definition of tool capabilities and validate tool inputs before calling the underlying handler.

### Provider adapter

`GeminiLangChainClient` is a temporary compatibility adapter, not the final architecture end-state.

It was chosen because:

- it isolates the current Gemini/LangChain dependency immediately
- it minimizes behavior change
- it reduces migration risk

The next provider migration can happen behind the same `LLMClient` interface.

## Options Explored

### Option A: Keep the old direct LangChain integration in `ChatService`

Description:

- continue calling `ChatGoogleGenerativeAI` directly from the service
- keep tool parsing and message conversion in the service

Pros:

- no new abstraction
- minimal code movement

Cons:

- business logic remains tightly coupled to provider/framework behavior
- testing stays awkward
- future provider swaps remain expensive
- the service layer remains a mix of orchestration and transport glue

Decision:

- rejected

Reason:

- this preserved the exact complexity we were trying to reduce

### Option B: Drop LangChain immediately and move straight to the Gemini native SDK

Description:

- remove LangChain from chat now
- implement Gemini tool calling directly with the provider SDK
- normalize into internal types

Pros:

- less framework dependency
- simpler stack long-term if Gemini remains the only provider
- clearer ownership of tool-calling semantics

Cons:

- larger migration in one step
- higher immediate behavioral risk
- provider-specific rewrite and app refactor at the same time

Decision:

- deferred

Reason:

- the adapter boundary was higher value than a one-step framework removal
- this can be done later behind the same `LLMClient` interface

### Option C: Adopt MCP for tool calling

Description:

- move chat tools behind an MCP server or MCP-compatible boundary
- have the chat agent consume tools over the protocol

Pros:

- standardized tool interface
- better multi-agent or multi-app reuse
- cleaner external tool boundary if many AI surfaces are planned

Cons:

- significantly more complexity
- weaker fit for request-scoped DB session and authenticated user context
- extra latency and operational overhead
- premature for a small internal chat tool surface

Decision:

- rejected for now

Reason:

- the current chat tools are application-internal capabilities, not a shared tool platform
- MCP solves a broader interoperability problem than this repo currently has

### Option D: Build a larger orchestration framework around Langfuse, Arize, or graph/state tooling

Description:

- push more agent orchestration, tracing, and tool semantics into external frameworks

Pros:

- richer traces
- more workflow features
- potentially more observability

Cons:

- complexity grows quickly
- multiple overlapping abstractions
- higher cognitive and maintenance cost
- easy to overbuild relative to the app’s current size

Decision:

- rejected

Reason:

- this repo benefits more from a crisp internal boundary than from more orchestration machinery

### Option E: Internal adapter boundary with current Gemini implementation behind it

Description:

- create application-owned internal types
- inject a provider adapter
- keep the current Gemini/LangChain implementation behind that boundary for now

Pros:

- immediate decoupling
- low migration risk
- better tests
- supports later provider swaps
- preserves current API behavior

Cons:

- adds one small abstraction layer
- does not remove LangChain yet
- still depends on Gemini/LangChain internally inside the adapter

Decision:

- accepted

Reason:

- best tradeoff between architectural improvement and implementation risk

## Consequences

### Positive

- `ChatService` is simpler and more application-focused.
- Provider-specific normalization is isolated.
- Tests can mock `LLMClient` directly.
- The path to a native Gemini client or another provider is clearer.

### Negative

- There is now one more internal module to understand.
- LangChain is still present in the chat stack, just behind the adapter.
- Some duplicate concepts exist temporarily: internal message/tool types and LangChain message/tool types.

## Follow-Up Work

1. Move to server-owned conversation state so the backend, not the frontend, is the source of truth for chat context.
2. Replace `GeminiLangChainClient` with a native Gemini SDK implementation if the team wants to reduce framework dependency further.
3. Consider structured chat response payloads for tool events or workout drafts instead of returning only a final message string.
4. Re-evaluate whether write actions such as workout logging should move from generic tool calling into explicit product workflows.

## Alternatives Not Chosen But Still Viable Later

- Native Gemini SDK behind `LLMClient`
- OpenAI or Anthropic adapter behind `LLMClient`
- MCP if tool reuse becomes a real cross-product requirement
- Workflow-oriented orchestration for write-heavy product actions

## Rollout and Compatibility

This RFC preserves the current `/chat` request and response shape.

No frontend API change is required for this decision.

The refactor is internal to the backend and is intended to be behavior-preserving.

## Verification

The adapter boundary is covered directly in [`tests/test_chat_llm_client.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/tests/test_chat_llm_client.py).

Chat service and router behavior continue to be covered in:

- [`tests/test_chat_service_happy_paths.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/tests/test_chat_service_happy_paths.py)
- [`tests/test_chat_tool_fallbacks.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/tests/test_chat_tool_fallbacks.py)
- [`tests/test_chat_router_happy_paths.py`](/Users/ndleyton/.codex/worktrees/953a/pe-be/backend/tests/test_chat_router_happy_paths.py)
