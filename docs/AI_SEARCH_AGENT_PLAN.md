# AI Search Agent Implementation Plan

## Overview

Integrate an AI-powered search assistant into the UniversalSearch component. Two modes:
1. **Direct Search** (keywords like "broast"): Use existing Sanity search API — businesses + products
2. **AI Mode** (questions like "What is the best broast?"): Stream AI response with RAG context and tool calling

## Architecture

```
User types in search
        │
        ├─ Keywords (broast, pizza, etc.)
        │  └─> Existing /api/home/search → Show businesses + products
        │
        └─ Question (what, how, best, recipe, etc.)
           └─> POST /api/search/chat (stream)
               ├─ Retrieve context: search Sanity + product data
               ├─ RAG: Pass context to LLM
               ├─ Tools: search_products, search_businesses, add_to_cart_suggestion
               └─ Stream response + optional UI parts (cards, buttons)
```

## Phases

### Phase 1: Foundation (Current)
- [x] Install `@ai-sdk/openai`
- [x] Create `/api/search/chat` — streaming chat endpoint
- [x] Question vs keyword detection heuristic
- [x] Integrate AI mode into UniversalSearch dropdown
- [x] Contextual RAG: use existing search API results as context (no vector DB yet)

### Phase 2: Tools & RAG
- [x] Add tools: `search_products`, `search_ingredients`
- [x] Fetch popular products (isPopular) for "best" queries
- [x] Structured context builder (businesses, products, isPopular, ingredients)

### Phase 3: Recipes & Ingredients
- [x] Recipe: general knowledge for how-to + local business recommendations
- [x] Tool: `search_ingredients` — match ingredients to Sanity products
- [x] Prompt: suggest user reply with ingredient names to search
- [x] Generative UI: useChat + tool parts for product cards
- [x] Product cards with Add to Cart + View menu

### Phase 4: Full RAG (Optional)
- [ ] Embeddings + vector DB (pgvector/Vercel Postgres) for semantic search
- [ ] Index products, businesses, categories
- [ ] Replace keyword search with semantic retrieval for AI context

## Key Files

| File | Purpose |
|------|---------|
| `app/api/search/chat/route.ts` | Streaming AI chat API |
| `lib/ai/search-context.ts` | Build RAG context from Sanity |
| `lib/ai/question-detection.ts` | Heuristic: is this a question? |
| `components/search/UniversalSearch.tsx` | UI: toggle direct vs AI, show stream |
| `components/search/SearchAIPanel.tsx` | AI response panel (streaming, cards) |

## Heuristics

**Question triggers** (AI mode): query contains `what`, `how`, `which`, `best`, `recipe`, `receipt`, `recommend`, `suggest`, `أفضل`, `ما`, `كيف`, `وصفة`, etc. Or ends with `?`.

**Keyword** (direct search): else → existing search API.

## Token & Cost Control

- Context: max ~15 businesses + 30 products (concise format)
- System prompt: ~200 tokens
- RAG-first: only pass retrieved data, no general knowledge fishing
- Tools reduce hallucination: AI must call tools for product/business data
