/**
 * POST /api/search/chat
 * Streaming AI chat for search questions. Uses RAG context, tools, and allows
 * general knowledge for recipes/how-to while recommending local businesses.
 * Supports both useChat (messages) and legacy fetch (query).
 */
import { streamText, tool, convertToModelMessages, type UIMessage } from 'ai'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { buildSearchContext } from '@/lib/ai/search-context'
import { searchProducts, searchIngredients } from '@/lib/ai/search-tools'
import { extractSearchQuery } from '@/lib/ai/extract-search-query'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages,
      query: bodyQuery,
      city = '',
      country = '',
      lang = 'en',
    } = body as {
      messages?: unknown[]
      query?: string
      city?: string
      country?: string
      lang?: 'en' | 'ar'
    }

    const cityVal = (city ?? '').trim()
    const langVal = lang === 'ar' ? 'ar' : 'en'

    if (!cityVal) {
      return Response.json({ error: 'city is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    let query = (bodyQuery ?? '').trim()
    if (!query && Array.isArray(messages)) {
      const lastUserMessage = [...messages].reverse().find((m) => (m as { role?: string })?.role === 'user')
      if (lastUserMessage) {
        const c = (lastUserMessage as { content?: unknown }).content
        if (typeof c === 'string') query = c.trim()
        else if (Array.isArray(c)) {
          const text = c.find((p: { type?: string; text?: string }) => p?.type === 'text')
          if (typeof (text as { text?: string })?.text === 'string') query = (text as { text: string }).text.trim()
        }
      }
    }

    const searchQuery = extractSearchQuery(query || '')
    const effectiveQuery = searchQuery || query || 'food restaurant'

    const ctx = await buildSearchContext({
      city: cityVal,
      country: (country ?? '').trim(),
      query: effectiveQuery,
      lang: langVal,
    })

    const systemPrompt = `You are a Personal Shopping Helper for Bedi Delivery, a food and goods delivery platform.
Your PRIMARY goal is to help users FIND and BUY from local businesses. You proactively suggest restaurants, cafes, grocery stores, and menu items to help them order.

**Context for ${cityVal}** (search: "${effectiveQuery}"):
${ctx.contextText}

**CRITICAL: ALWAYS SEARCH WHEN USER WANTS FOOD/PRODUCTS**
When the user expresses ANY desire for food or products (e.g. "I feel like eating tenders", "I want pizza", "suggest places for shawarma", "craving burgers", "looking for coffee"), you MUST call search_products FIRST with the key item name (e.g. "tenders", "pizza", "shawarma", "burgers", "coffee"). Extract the main food/product term from conversational language—do NOT pass the full sentence. Use 1–3 keywords max (e.g. "chicken tenders", "pizza", "fresh juice").
- NEVER respond without concrete suggestions when the user is asking for recommendations.
- If context is empty, you MUST still call search_products—the tool searches the live database.
- Recommend BOTH: restaurants that serve cooked dishes AND markets/stores that sell ingredients/products.
- For each suggestion: name the business, mention specific menu items if available, and include the link: /t/[slug]

**RECIPES and HOW-TO** (e.g. "how to make broast"):
- Provide a concise recipe, then call search_products for businesses that offer the dish.
- Ask "Would you like me to find these ingredients in our stores?" and use show_quick_reply_buttons type "yes_no".

**INGREDIENTS SEARCH (search_ingredients tool)**:
- When the tool returns products: ONLY suggest products that match the user's requested ingredients. Never suggest irrelevant items (e.g. do NOT suggest cheese when user asked for chicken ingredients).
- When the tool returns NO products (empty): Inform the user clearly: "I couldn't find [ingredients] in our stores." Offer to search for alternatives or different ingredient names.
- The tool returns soughtIngredients—use these to verify relevance. If products don't match, say you couldn't find them.

**FORMATTING**: Use markdown for better readability: **bold** for emphasis, numbered lists for recipes/steps, bullet lists for options. Format links as [text](/t/slug).

**GENERAL**:
- Always respond in the user's language (English or Arabic).
- Prefer products/businesses marked [POPULAR].
- Keep responses concise but actionable—always include at least one /t/[slug] link when suggesting places.

**INTERACTIVE BUTTONS** (when applicable):
- Yes/No questions → show_quick_reply_buttons type "yes_no"
- Quick options (e.g. "Find ingredients", "Show stores") → show_quick_reply_buttons type "custom" with options array`

    const tools = {
      search_products: tool({
        description:
          'Search the database for products and businesses by keyword. ALWAYS call this when user wants food/product suggestions. Use 1-3 keywords only (e.g. "tenders", "pizza", "chicken broast")—never the full conversational sentence.',
        inputSchema: z.object({
          query: z.string().describe('1-3 search keywords, e.g. tenders, pizza, chicken, shawarma'),
        }),
        execute: async ({ query: q }) => {
          return searchProducts({
            city: cityVal,
            country: (country ?? '').trim(),
            query: q,
            limit: 25,
          })
        },
      }),
      search_ingredients: tool({
        description:
          'Search for products matching recipe ingredients. Use ONLY after user confirms. Returns products, byStore, and soughtIngredients. If empty—inform user, do NOT suggest unrelated products.',
        inputSchema: z.object({
          ingredients: z.array(z.string()).describe('List of ingredient names to search for'),
        }),
        execute: async ({ ingredients }) => {
          return searchIngredients({
            city: cityVal,
            country: (country ?? '').trim(),
            ingredients,
            lang: langVal,
          })
        },
      }),
      show_quick_reply_buttons: tool({
        description:
          'Show clickable Yes/No or custom quick-reply buttons to the user. Use when asking a Yes/No question (type yes_no) or when offering 2-4 quick options (type custom with options array). Only use when it improves UX.',
        inputSchema: z.object({
          type: z.enum(['yes_no', 'custom']).describe('yes_no for Yes/No buttons, custom for specific options'),
          options: z
            .array(z.string())
            .optional()
            .describe('For type custom: button labels (e.g. ["Find ingredients", "Show stores"])'),
          prompt: z.string().optional().describe('Optional short prompt shown above the buttons'),
        }),
        execute: async ({ type, options, prompt }) => {
          if (type === 'yes_no') {
            return { type: 'yes_no', options: ['Yes', 'No'], prompt: prompt ?? null }
          }
          if (type === 'custom' && options?.length) {
            return { type: 'custom', options: options.slice(0, 4), prompt: prompt ?? null }
          }
          return { type, options: options ?? [], prompt: prompt ?? null }
        },
      }),
    }

    const hasMessages = Array.isArray(messages) && messages.length > 0
    const streamOptions = {
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      tools,
      maxSteps: 5,
    }
    const result = hasMessages
      ? streamText({
          ...streamOptions,
          messages: await convertToModelMessages(messages as UIMessage[]),
        })
      : streamText({
          ...streamOptions,
          prompt: query || 'Help me find food',
        })

    return result.toUIMessageStreamResponse()
  } catch (e) {
    console.error('[search/chat]', e)
    return Response.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
