# RFC 0009: PersonalBestie Model Selection and Quota Optimization (Revised)

This Request for Comments (RFC) evaluates our current GenAI model configurations against the latest Google Gemini offerings (as of mid-2026). It presents architectural and configuration options to balance price, speed, reasoning quality, and API credit usage under a **Google One AI Pro** subscription (1,000 monthly AI credits), specifically addressing the constraint that Gemini 3.5 Flash is cost-prohibitive.

---

## Executive Summary & Goals

PersonalBestie utilizes Google Gemini for several key user features:
1. **Interactive Chat Assistant** (requires server-side tool calling and multimodal image understanding).
2. **Post-Workout AI Recaps** (asynchronous metrics analysis and qualitative coaching).
3. **Workout Parser** (extraction of exercises, sets, and reps from natural text inputs).
4. **Exercise Image Pipeline** (multimodal references and phase detection).

Our goals are to:
- **Minimize Response Latency** for interactive components (specifically Chat and parsing).
- **Maximize Cost-Efficiency** to stay well within the 1,000 monthly AI credit budget.
- **Maintain High Accuracy** for structured outputs and function calling.
- **Adopt Stable, Budget-Friendly Aliases** rather than expensive premium models.

---

## Gemini Model Landscape & Pricing (Per 1M Tokens)

Google's current lineup offers distinct price-to-performance tiers:

| Model Tier | Input Price / 1M | Output Price / 1M | Latency / Speed | Ideal Workloads |
| :--- | :--- | :--- | :--- | :--- |
| **Gemini 2.5 Flash-Lite** | \$0.10 | \$0.40 | **Ultra-Fast** (<1.5s) | High-volume, structured parsing, short recaps |
| **Gemini 3.1 Flash-Lite** | \$0.25 | \$1.50 | **Ultra-Fast** (<1.5s) | Lightweight chat, structured outputs |
| **Gemini 2.5 Flash** | \$0.30 | \$2.50 | **Fast** (<2s) | Standard chat, multi-turn reasoning, tool use |
| **Gemini 3 Flash Preview** | \$0.50 | \$3.00 | **Fast / Reasoning** | Advanced chat, interactive debugging |
| **Gemini 3.5 Flash** | \$0.75 | \$4.50 | **Fast / Reasoning** | High-performance multimodal reasoning |

---

## Budgeting Strategy: 1,000 AI Credits

Under a **Google One AI Pro** subscription allocating **1,000 AI credits** monthly, avoiding premium models like Gemini 3.5 Flash is essential for sustainable operations. 

By standardizing on **Flash-Lite** and entry-level **Flash** models:
1. **Chat Costs Reduction:** Running the main Chat Assistant on `gemini-2.5-flash-lite` or `gemini-3.1-flash-lite` instead of a 3.5-class model reduces token costs by up to **85%**.
2. **High-Volume Safety:** Background tasks like workout parsing and post-workout recaps remain on the highly efficient `gemini-2.5-flash-lite` layer, ensuring they consume negligible credit volume.

---

## Proposed Model Routing Configuration (Ultra-Low Cost)

We propose the following cost-optimized configuration mapping in `backend/.env.production.template` and Pydantic `Settings`:

### 1. Workout Recaps & Parsers
*   **Current Model:** `gemini-2.5-flash-lite`
*   **Proposed Model:** Keep `gemini-2.5-flash-lite`.
*   **Rationale:** At \$0.10 per 1M input tokens, this is the most cost-effective tier available, providing rapid response times (<1.5s) and sufficient accuracy for structured data extraction and summary writing.

### 2. Main Chat Assistant
*   **Current Model:** `gemini-2.5-flash`
*   **Option A (Extreme Budget):** Downgrade to `gemini-2.5-flash-lite` or `gemini-3.1-flash-lite`.
    *   *Pros:* Extremely low credit burn; ultra-fast response times.
    *   *Cons:* Slightly reduced reasoning accuracy for multi-step tool execution.
*   **Option B (Balanced Budget - Recommended):** Maintain `gemini-2.5-flash`.
    *   *Pros:* Proven reliability with personal-bestie custom tools and image attachments; lower cost than the newer 3.5 Flash or 3.x Preview models.
    *   *Cons:* Marginally higher cost than Flash-Lite.

---

## Suggested Configuration Updates

### `backend/.env.production.template` (Option B: Balanced Budget)
```ini
CHAT_MODEL=gemini-2.5-flash
WORKOUT_PARSER_MODEL=gemini-2.5-flash-lite
WORKOUT_RECAP_MODEL=gemini-2.5-flash-lite
EXERCISE_IMAGE_PHASE_MODEL=gemini-2.5-flash-image
```

### `backend/.env.production.template` (Option A: Extreme Budget)
```ini
CHAT_MODEL=gemini-3.1-flash-lite
WORKOUT_PARSER_MODEL=gemini-2.5-flash-lite
WORKOUT_RECAP_MODEL=gemini-2.5-flash-lite
EXERCISE_IMAGE_PHASE_MODEL=gemini-2.5-flash-image
```
