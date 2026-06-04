/**
 * Intent Detection Engine
 *
 * Figures out WHO a status is about and WHAT the poster's intent is.
 *
 * Examples:
 *  "Happy Birthday! 🎂"                    → SELF_EVENT (poster's own birthday)
 *  "Happy Birthday Ajit! 🎂"               → WISHING_SOMEONE (Ajit = someone else, relation unclear)
 *  "Wishing my brother a very happy bday"  → WISHING_SOMEONE (brother = known relation)
 *  "We got married! ❤️"                    → SELF_EVENT
 *  "Congratulations to my sister!"         → WISHING_SOMEONE
 *  "Feeling so blessed today 🙏"           → SELF_EMOTION
 *  "New shop opening! Grand launch 🎉"     → SELF_EVENT (business)
 */

export type IntentType =
  | 'SELF_EVENT'        // poster's own life event (own birthday, own marriage, own new car)
  | 'WISHING_SOMEONE'   // poster is wishing someone else
  | 'SELF_EMOTION'      // emotional expression about self
  | 'ANNOUNCEMENT'      // sharing news (could be self or others)
  | 'GENERAL'           // unclear / generic

export type RelationToSelf =
  | 'SELF'
  | 'FRIEND'
  | 'SIBLING'
  | 'PARENT'
  | 'SPOUSE'
  | 'CHILD'
  | 'COLLEAGUE'
  | 'UNKNOWN'

export interface IntentResult {
  intent: IntentType
  targetName?: string          // name extracted from status (e.g. "Ajit")
  relation: RelationToSelf
  confidence: number           // 0–1
  replyStrategy: ReplyStrategy
  reasoning: string            // human-readable explanation
}

export interface ReplyStrategy {
  /**
   * Should we address the POSTER or the THIRD PERSON?
   * "Hi Pooja, wish Ajit a very happy birthday from us!"
   *  vs
   * "Happy Birthday Pooja! 🎂"
   */
  addressPoster: boolean
  /**
   * Name to use in the reply message
   * - if SELF_EVENT: poster's own name
   * - if WISHING_SOMEONE: the target's name (Ajit)
   */
  nameInReply: string
  /**
   * Tone modifier
   */
  tone: 'celebratory' | 'empathetic' | 'congratulatory' | 'supportive' | 'warm'
  /**
   * Whether to reference the third person by name in our reply
   */
  mentionThirdPerson: boolean
  thirdPersonName?: string
}

// ─── Pattern sets ─────────────────────────────────────────────────────────────

// Words that signal the poster is WISHING someone else
const WISHING_PATTERNS = [
  /\bhappy birthday\s+([A-Za-z]+)/i,
  /\bwishing\s+(my\s+)?(?:dear\s+)?([A-Za-z]+)/i,
  /\bcongratulations?\s+(?:to\s+)?(?:my\s+)?([A-Za-z]+)/i,
  /\bcongrats?\s+(?:to\s+)?(?:my\s+)?([A-Za-z]+)/i,
  /\bhbd\s+([A-Za-z]+)/i,
  /\bmany happy returns\s+(?:of\s+the\s+day\s+)?([A-Za-z]+)/i,
  /\bwish you\s+([A-Za-z]+)/i,
  /\bwishing\s+([A-Za-z]+)\s+a/i,
  /^([A-Za-z]+)\s+(?:bhai|didi|ji|bro|sis|yaar)\b/i,  // "Ajit bhai happy birthday"
]

// Words that indicate SELF events
const SELF_EVENT_SIGNALS = [
  /\bit'?s\s+my\s+birthday/i,
  /\bmy\s+birthday/i,
  /\bi'?m?\s+(?:so\s+)?(?:turning|celebrating)/i,
  /\bwe\s+(?:got\s+married|are\s+married|tied\s+the\s+knot)/i,
  /\bwe\s+(?:got|are)\s+engaged/i,
  /\bjust\s+got\s+(?:promoted|married|engaged|home|car)/i,
  /\bmy\s+new\s+(?:car|home|house|shop|business|job)/i,
  /\bi\s+(?:got|have|passed|cleared|achieved|graduated)/i,
  /\bour\s+(?:new|baby|home|wedding|anniversary)/i,
  /\bfinally\s+(?:got|did|moved|bought)/i,
  /\bborn\s+today/i,
  /\banother\s+year\s+(?:older|wiser)/i,
]

// Relation keywords — these appear in "my [relation]" constructs
const RELATION_MAP: Record<string, RelationToSelf> = {
  'brother': 'SIBLING', 'bro': 'SIBLING', 'bhai': 'SIBLING',
  'sister': 'SIBLING', 'sis': 'SIBLING', 'didi': 'SIBLING', 'behen': 'SIBLING',
  'dad': 'PARENT', 'father': 'PARENT', 'papa': 'PARENT', 'pita': 'PARENT',
  'mom': 'PARENT', 'mother': 'PARENT', 'mama': 'PARENT', 'maa': 'PARENT',
  'wife': 'SPOUSE', 'husband': 'SPOUSE', 'pati': 'SPOUSE', 'patni': 'SPOUSE',
  'son': 'CHILD', 'daughter': 'CHILD', 'beta': 'CHILD', 'beti': 'CHILD',
  'friend': 'FRIEND', 'bestie': 'FRIEND', 'yaar': 'FRIEND', 'dost': 'FRIEND',
  'colleague': 'COLLEAGUE', 'boss': 'COLLEAGUE', 'mentor': 'COLLEAGUE',
}

// Names we should NOT treat as event targets (common false positives)
const STOP_WORDS = new Set([
  'happy', 'wishing', 'have', 'very', 'much', 'dear', 'our', 'your',
  'all', 'the', 'and', 'you', 'with', 'may', 'god', 'bless', 'new',
  'many', 'more', 'great', 'best', 'love', 'amazing', 'thanks',
])

// ─── Name extraction helper ───────────────────────────────────────────────────

function extractTargetName(text: string): string | undefined {
  // "Happy Birthday Ajit" → Ajit
  for (const pattern of WISHING_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      // Last capture group is the name
      const name = match[match.length - 1]
      if (name && !STOP_WORDS.has(name.toLowerCase()) && name.length > 1) {
        return capitalize(name)
      }
    }
  }

  // Fallback: look for capitalized words after "birthday" / "bday" / "congrats"
  const fallback = text.match(/(?:birthday|bday|congrats?|congratulations?)\s+([A-Z][a-z]{2,})/i)
  if (fallback?.[1] && !STOP_WORDS.has(fallback[1].toLowerCase())) {
    return capitalize(fallback[1])
  }

  return undefined
}

function extractRelation(text: string): RelationToSelf {
  const lower = text.toLowerCase()
  for (const [keyword, relation] of Object.entries(RELATION_MAP)) {
    if (lower.includes(` my ${keyword}`) || lower.includes(` my ${keyword}`) || lower.includes(`my ${keyword}`)) {
      return relation
    }
  }
  return 'UNKNOWN'
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ─── Main detection function ──────────────────────────────────────────────────

export function detectIntent(
  statusText: string,
  posterName: string,
  eventType?: string | null
): IntentResult {
  const text = statusText.trim()
  const posterFirstName = posterName.split(' ')[0]

  // 1. Check for self-event signals first
  const isSelf = SELF_EVENT_SIGNALS.some(p => p.test(text))
  if (isSelf) {
    return {
      intent: 'SELF_EVENT',
      relation: 'SELF',
      confidence: 0.85,
      replyStrategy: {
        addressPoster: true,
        nameInReply: posterFirstName,
        tone: 'celebratory',
        mentionThirdPerson: false,
      },
      reasoning: `Status uses first-person language indicating poster's own event`,
    }
  }

  // 2. Try to extract third-person target
  const targetName = extractTargetName(text)
  const relation = extractRelation(text)

  if (targetName) {
    // Poster is wishing someone else by name
    const isRelationKnown = relation !== 'UNKNOWN'
    return {
      intent: 'WISHING_SOMEONE',
      targetName,
      relation,
      confidence: isRelationKnown ? 0.9 : 0.75,
      replyStrategy: {
        addressPoster: true,          // We reply TO the poster
        nameInReply: posterFirstName, // We address the poster
        tone: 'celebratory',
        mentionThirdPerson: true,     // We mention the target person
        thirdPersonName: targetName,
      },
      reasoning: isRelationKnown
        ? `Poster is wishing their ${relation} "${targetName}"`
        : `Poster is wishing someone named "${targetName}" (relation unclear, could be friend/family)`,
    }
  }

  // 3. Pure emotional / generic
  if (eventType === 'SAD_EMOTION') {
    return {
      intent: 'SELF_EMOTION',
      relation: 'SELF',
      confidence: 0.8,
      replyStrategy: {
        addressPoster: true,
        nameInReply: posterFirstName,
        tone: 'empathetic',
        mentionThirdPerson: false,
      },
      reasoning: 'Emotional status — poster expressing personal feelings',
    }
  }

  // 4. Generic / unclear
  return {
    intent: 'GENERAL',
    relation: 'UNKNOWN',
    confidence: 0.5,
    replyStrategy: {
      addressPoster: true,
      nameInReply: posterFirstName,
      tone: 'warm',
      mentionThirdPerson: false,
    },
    reasoning: 'General status — no specific intent signals detected',
  }
}
