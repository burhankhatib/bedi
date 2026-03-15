# Search & AI Chat UX Overhaul — Plan & Suggestions

## Executive Summary

This document outlines a comprehensive plan to address:
1. **AI relevance** — Ingredients vs. ready meals (e.g. omelette ingredients ≠ Fries with Cheese)
2. **Search stability** — "Broast" returning no results; persistent "No results" after clearing
3. **Mobile experience** — Full-screen conversational chat using Material 3
4. **Desktop experience** — Real chat feel, no text overlap, clearer new vs. continued chat

---

## Problem 1: AI Relevance (Ingredients vs. Ready Meals)

### What’s happening
- User asks for **omelette ingredients** → AI offers "Fries with Cheese" because "cheese" matches
- User needs **ingredients to cook**, not restaurant dishes

### Root cause
`search_ingredients` runs across **all businesses** (restaurants + groceries). It matches products by ingredient name only. So "Fries with Cheese" matches "cheese", even though it’s a ready meal, not an ingredient.

### Solution
**Scope ingredient search to grocery-like businesses only**

| Business type   | Use for ingredients? | Use for ready meals? |
|----------------|----------------------|----------------------|
| grocery        | ✅ Yes               | ❌ No                |
| supermarket    | ✅ Yes               | ❌ No                |
| greengrocer    | ✅ Yes               | ❌ No                |
| retail         | Maybe                | ❌ No                |
| restaurant     | ❌ No                | ✅ Yes               |
| cafe           | ❌ No                | ✅ Yes               |
| bakery         | ❌ No                | ✅ Yes               |

**Implementation**:
- In `lib/ai/search-tools.ts`, add an optional `ingredientSourceOnly?: boolean` to `searchIngredients`
- When `ingredientSourceOnly` is true, filter tenants by `businessType in ['grocery','supermarket','greengrocer','retail','pharmacy']`
- The chat API should pass `ingredientSourceOnly: true` when the user chose "Find ingredients to cook"

**Prompt refinement**:
- Strengthen the system prompt: *"When search_ingredients is called, ONLY return products from grocery/market/supermarket/greengrocer. Never suggest restaurant meals (e.g. Fries with Cheese) as ingredients."*

---

## Problem 2: Search Stability

### 2a. "Broast" returns no results
**Possible causes**:
- No businesses/products with "broast" in the selected city
- Search uses strict `match` with `*broast*` — might need `match` vs `match` case handling
- Business names like "King Broast" should match; products from that business should appear via `site._ref in matchingTenantIds`

**Improvements**:
1. **Fuzzy / "Did you mean"** — Already present; verify it’s shown in the search UI
2. **Partial matching** — Check Sanity `match` behavior for "broast" and Arabic variants (بروست)
3. **Business-first for brand names** — For short queries (e.g. "broast"), boost business-name matches and ensure their products are included

### 2b. Persistent "No results" after clearing
**Likely cause**: State and URL can get out of sync when the user clears the input.

**Fixes**:
1. **Clear-on-empty** — When `query` becomes empty, immediately:
   - Clear `searchResults`
   - Update URL (remove `q`)
   - Reset `loading` to false
2. **Debounce edge case** — On clear, cancel debounce and update `debouncedQuery` immediately
3. **Single source of truth** — Prefer URL (`searchParams.q`) as source of truth; sync input to URL, not the reverse

---

## Problem 3: Mobile — Full-Screen Conversational Chat

### Current state
- Search bar opens a dropdown with AI panel
- Limited height (`max-h-[320px]`)
- Feels cramped, not like a chat app

### Proposed direction: Mobile-first chat sheet

**Layout (mobile only)**:
1. **Entry** — Tap search bar → bottom sheet or full-screen overlay
2. **Chat view** — Full viewport for messages:
   - User messages: right-aligned bubbles
   - AI messages: left-aligned with rich content (cards, buttons)
3. **Input** — Sticky input at bottom with safe-area padding
4. **Header** — "AI Assistant" + New chat + Close

**Material 3 details**:
- 8dp grid spacing
- Primary/secondary color tokens
- Standard easing (200–300ms) for sheet open/close
- Proper safe-area insets (notch, home indicator)

**Implementation outline**:
- New component: `SearchChatSheet` (mobile) / `SearchChatPanel` (desktop)
- Use `Sheet` (or a full-screen modal) on mobile when `md` breakpoint is not met
- Reuse `SearchAIPanel` logic; change layout for full-screen

---

## Problem 4: Desktop — Real Chat Experience

### Current state
- Dropdown under search bar
- Messages can feel cramped
- "New chat" is not very noticeable
- Text can overlap fixed elements

### Proposed direction: Side panel or dedicated chat area

**Option A: Right-side chat drawer**
- Search bar stays in header
- On AI question: open a right-side drawer (e.g. 400px on desktop)
- Full-height chat area, input at bottom
- Clear "New chat" button and visual separation between conversations

**Option B: Dedicated `/search?mode=chat`**
- Search page has tabs or toggle: "Browse" | "Ask AI"
- "Ask AI" shows a full-width chat layout
- Search bar moves to top of chat

**Option C: Inline expansion**
- Expand the dropdown into a larger panel (e.g. max 600px wide)
- Stays below search bar but gets more height
- Simpler change, fewer UX changes

**Recommendation**: **Option A** (right-side drawer) — keeps context visible while providing a clear chat space.

---

## Problem 5: Visual Clarity — New vs. Continued Chat

### New chat
- Prominent "New chat" or "+" button
- Optional empty-state illustration
- Clear reset behavior (e.g. icon + label)

### Continued chat
- "Resume chat" visible when localStorage has previous messages
- Optional last-message preview
- Different styling (e.g. outline vs filled) for resume vs new

### No text behind elements
- Ensure `z-index` and stacking context
- Avoid fixed/sticky elements overlapping messages
- Add `pb-` padding so the last message clears the input area
- Use `scroll-margin-bottom` on message anchors if needed

---

## Implementation Phases

### Phase 1: Quick wins (1–2 days)
1. **Ingredient scoping** — Limit `search_ingredients` to grocery-type businesses
2. **Search state robustness** — Clear results on empty, sync URL immediately on clear
3. **Prompt update** — Explicit rules for ingredients vs. ready meals

### Phase 2: Search reliability
1. Add/verify Arabic "broast" variants in search if needed
2. Improve fuzzy/did-you-mean visibility
3. Add optional analytics to debug "no results" for common queries

### Phase 3: Mobile full-screen chat
1. Implement `SearchChatSheet` for mobile
2. Material 3 styling (spacing, colors, motion)
3. Integrate with existing `SearchAIPanel` logic

### Phase 4: Desktop chat UX
1. Implement right-side drawer (or chosen option)
2. New chat vs. resume chat visuals
3. Fix overlap and spacing issues

---

## Decisions Needed From You

1. **Desktop chat placement**: Option A (right drawer), B (dedicated page), or C (inline expansion)?
2. **Mobile entry**: Bottom sheet vs. full-screen modal for the chat?
3. **Scope**: Start with Phase 1 only, or proceed through Phase 4?

Share your preferences and we can move into implementation details next.
