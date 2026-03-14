/** localStorage key for guest AI search questions (synced on login). */
export const AI_SEARCH_QUESTIONS_KEY = 'aiSearchQuestions'

export type StoredQuestion = { question: string; askedAt: string }

export function getStoredGuestQuestions(): StoredQuestion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(AI_SEARCH_QUESTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p): p is { question?: string; askedAt?: string } => p && typeof p === 'object')
      .map((p) => ({
        question: typeof p.question === 'string' ? p.question.trim() : '',
        askedAt: typeof p.askedAt === 'string' ? p.askedAt : new Date().toISOString(),
      }))
      .filter((p) => p.question.length > 0)
  } catch {
    return []
  }
}

export function addGuestQuestion(question: string): void {
  if (typeof window === 'undefined') return
  const q = typeof question === 'string' ? question.trim() : ''
  if (!q) return
  const list = getStoredGuestQuestions()
  list.unshift({ question: q, askedAt: new Date().toISOString() })
  try {
    localStorage.setItem(AI_SEARCH_QUESTIONS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function clearStoredGuestQuestions(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AI_SEARCH_QUESTIONS_KEY)
  } catch {
    /* ignore */
  }
}
