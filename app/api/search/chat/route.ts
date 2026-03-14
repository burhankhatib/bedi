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

    const ctx = await buildSearchContext({
      city: cityVal,
      country: (country ?? '').trim(),
      query: query || 'food restaurant',
      lang: langVal,
    })

    const systemPrompt = `You are a helpful assistant for Bedi Delivery, a food and goods delivery platform.
You help customers find businesses (restaurants, cafes, grocery stores, etc.) and products in their city.

**Context for ${cityVal}:**
${ctx.contextText}

**For RECIPES and HOW-TO questions** (e.g. "how to make broast", "what is the best broast recipe"):
- Use your general knowledge to provide a clear, step-by-step recipe or instructions.
- Format recipes with numbered steps. Keep them concise but complete.
- After the recipe, recommend local businesses from the context above that offer this dish.
- After the recipe, ask "Would you like me to find these ingredients in our stores? Reply with the ingredient names (e.g. chicken, spices) to search."

**For "BEST" and RECOMMENDATION questions** (e.g. "what is the best broast you have"):
- Use the context and search_products tool. Prefer products/businesses marked [POPULAR].
- Call search_products to get fresh results when needed.
- Recommend specific businesses with their name and link: /t/[slug]

**For general SEARCH**:
- Use search_products to find matching items.
- Always respond in the same language as the user (English or Arabic).
- Keep responses concise and helpful.
- When recommending, mention the business name and suggest visiting /t/[slug] for the full menu.

**INTERACTIVE BUTTONS** (use only when applicable):
- When you ask a Yes/No question (e.g. "Would you like me to find these ingredients in our stores?"), call show_quick_reply_buttons with type "yes_no" so the user can tap Yes or No.
- When you want to offer 2-4 quick options (e.g. "Find ingredients", "Show me stores", "View recipe again"), call show_quick_reply_buttons with type "custom" and options array.
- Use show_quick_reply_buttons ONLY when it clearly improves UX—not for every message.`

    const tools = {
      search_products: tool({
        description:
          'Search for products and businesses by keyword. Use for finding items, "best" recommendations, or when user asks what is available.',
        inputSchema: z.object({
          query: z.string().describe('Search terms (e.g. broast, pizza, chicken)'),
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
          'Search for products that match a list of recipe ingredients. Use AFTER user confirms they want to shop for ingredients. Prefer stores with most matching items. Return products grouped by store.',
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
    const result = hasMessages
      ? streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools,
        })
      : streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          prompt: query || 'Help me find food',
          tools,
        })

    return result.toUIMessageStreamResponse()
  } catch (e) {
    console.error('[search/chat]', e)
    return Response.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
