import OpenAI from 'openai';
import { Contact, Status, EventType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { detectIntent, IntentResult } from './intentDetection';

// Use Groq (OpenAI-compatible) with env-based config
const groq = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
});

const MODEL = process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile';

export interface ReplyGenerationInput {
  status: Status;
  contact: Contact | null;
  eventType: EventType;
  previousEngagements?: number;
  statusType?: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document';
}

export interface ReplyGenerationResult {
  text: string;
  tokensUsed: number;
  intent: IntentResult;
}

// ─── Event context descriptions ───────────────────────────────────────────────
const getEventContext = (eventType: EventType): string => {
  const contexts: Record<string, string> = {
    BIRTHDAY: 'Birthday celebration',
    ANNIVERSARY: 'Anniversary (wedding or other)',
    ACHIEVEMENT: 'Achievement, promotion, or milestone',
    FESTIVAL: 'Festival or holiday greeting',
    SAD_EMOTION: 'Sad or emotional post — needs empathy',
    POSITIVE: 'Positive, happy, or grateful post',
    OTHER: 'General post',
  };
  return contexts[eventType] || contexts.OTHER;
};

const getStatusTypeContext = (statusType?: string, statusText?: string): string => {
  const isPlaceholder = !statusText ||
    statusText === '[Image Status]' ||
    statusText === '[Sticker Status]' ||
    statusText === '[Video Status]';

  switch (statusType) {
    case 'image':
    case 'sticker':
      if (isPlaceholder) return 'an image status (no caption — the image content was analyzed by AI)';
      // If statusText is vision-enriched (long description), use it as context
      return statusText!.length > 60
        ? `an image status. AI analyzed the image and found: "${statusText}"`
        : `an image status with caption: "${statusText}"`;
    case 'video':
      return isPlaceholder ? 'a video status' : `a video status with caption: "${statusText}"`;
    case 'audio': return 'a voice/audio status';
    case 'document': return 'a document status';
    default: return `a text status: "${statusText}"`;
  }
};

// ─── System prompt ────────────────────────────────────────────────────────────
const buildSystemPrompt = (): string => {
  return `You are a WhatsApp relationship manager for a business. You generate short, warm, human WhatsApp messages to send to customers based on their WhatsApp status posts.

ABSOLUTE RULES:
- Keep replies SHORT: 2–4 lines max
- Sound human, warm, genuine — NEVER corporate or robotic
- Include 1–2 relevant emojis (not more)
- NEVER be salesy, promotional, or pushy
- Match the language/tone of the original status (Hinglish, Hindi, English, etc.)
- Never mention that you saw their "WhatsApp status"
- Make it feel like a personal message from a business that genuinely cares

INTENT-BASED REPLY LOGIC:
- If the person is WISHING SOMEONE ELSE (e.g. "Happy Birthday Ajit"): 
  → Reply TO the poster and INCLUDE the third person's name
  → Example: "Wish Ajit a very very happy birthday from us too! 🎂 Hope he has an amazing day!"
  → You DON'T know the relation — it could be brother, friend, colleague — so keep it warm but neutral
- If the person is celebrating THEIR OWN event:
  → Reply TO them directly
  → Example: "Happy Birthday [Name]! 🎂 Hope your day is as wonderful as you are!"
- If someone is SAD or going through a tough time:
  → Be empathetic, NO business mentions
- Never assume gender unless it's clear from the name or context`;
};

// ─── User prompt — intent-aware ───────────────────────────────────────────────
const buildUserPrompt = (
  input: ReplyGenerationInput,
  intent: IntentResult,
): string => {
  const { status, contact, eventType, statusType } = input;
  const posterName = contact?.name || status.contactName;
  const posterFirstName = posterName.split(' ')[0];
  const statusDescription = getStatusTypeContext(statusType, status.statusText);
  const strategy = intent.replyStrategy;

  let prompt = `Generate a WhatsApp reply based on this situation:

POSTER (the person who posted the status): ${posterName} (First name: ${posterFirstName})
STATUS POSTED: ${statusDescription}
EVENT TYPE: ${getEventContext(eventType)}
INTENT DETECTED: ${intent.intent} — ${intent.reasoning}`;

  // Intent-specific instructions
  if (intent.intent === 'WISHING_SOMEONE' && intent.targetName) {
    prompt += `

CRITICAL: The poster is wishing someone named "${intent.targetName}". 
We DO NOT know the exact relation (could be friend, brother, cousin, colleague etc.)
Your reply must:
1. Be addressed TO the poster (${posterFirstName})  
2. Wish "${intent.targetName}" a very happy ${eventType.toLowerCase().replace('_', ' ')} on behalf of the business
3. Sound warm and personal, NOT like a template
4. DO NOT say things like "your friend" or "your brother" since we don't know the relation

Example style: "Wish Ajit a very very happy birthday from us too! 🎂 Hope he has a wonderful celebration! 🎉"`;
  } else if (intent.intent === 'SELF_EVENT') {
    prompt += `

The poster is celebrating their OWN ${eventType.toLowerCase().replace('_', ' ')}.
Address them directly by their first name (${posterFirstName}).`;
  } else if (intent.intent === 'SELF_EMOTION') {
    prompt += `

The poster is expressing personal emotions. Be empathetic and supportive. 
DO NOT mention anything business-related.`;
  }

  // CRM context
  if (contact) {
    prompt += `

CRM INFO (use subtly if natural, don't force it):
- Lead Stage: ${contact.leadStage}
- City: ${contact.city || 'Unknown'}
- Tags: ${contact.tags.join(', ') || 'None'}`;
    if (contact.notes) {
      prompt += `\n- Notes: ${contact.notes.substring(0, 150)}`;
    }
  }

  if (input.previousEngagements && input.previousEngagements > 0) {
    prompt += `\n- This is an existing relationship (${input.previousEngagements} previous interactions)`;
  }

  prompt += `\n\nGenerate ONE reply message. Just the message text, no quotes, no explanation, no labels.`;
  return prompt;
};

// ─── Fallback reply (no API key) ─────────────────────────────────────────────
const buildFallbackReply = (input: ReplyGenerationInput, intent: IntentResult): string => {
  const posterFirst = (input.contact?.name || input.status.contactName).split(' ')[0];
  const target = intent.targetName;

  if (intent.intent === 'WISHING_SOMEONE' && target) {
    const eventLabel = input.eventType === 'BIRTHDAY' ? 'birthday'
      : input.eventType === 'ANNIVERSARY' ? 'anniversary'
      : input.eventType.toLowerCase().replace('_', ' ');
    return `Wish ${target} a very very happy ${eventLabel} from us too! 🎂 Hope they have a fantastic celebration! 🎉`;
  }

  const templates: Partial<Record<EventType, string>> = {
    BIRTHDAY: `Happy Birthday ${posterFirst}! 🎂 Hope your day is filled with joy and amazing moments! 🎉`,
    ANNIVERSARY: `Happy Anniversary ${posterFirst}! 💍 Wishing you many more beautiful years ahead! 🥂`,
    ACHIEVEMENT: `Congratulations ${posterFirst}! 🏆 So proud of your achievement! You truly deserve it! 🌟`,
    FESTIVAL: `Happy celebrations ${posterFirst}! 🎊 Wishing you and your family a joyful time! ✨`,
    SAD_EMOTION: `Thinking of you, ${posterFirst} 💙 Sending you strength and warm wishes. Take care of yourself.`,
    POSITIVE: `Love the positive energy, ${posterFirst}! 😊 Wishing you more amazing moments like these! 🌟`,
  };

  return templates[input.eventType] || `Hey ${posterFirst}! 😊 Hope you're having a wonderful day! 🌟`;
};

// ─── Main generate function ───────────────────────────────────────────────────
export const generateReply = async (
  input: ReplyGenerationInput,
): Promise<ReplyGenerationResult> => {
  const posterName = input.contact?.name || input.status.contactName;

  // Detect intent first
  const intent = detectIntent(
    input.status.statusText,
    posterName,
    input.eventType,
  );

  logger.info(
    `[Intent] ${posterName} | ${input.eventType} | ${intent.intent}` +
    (intent.targetName ? ` → target: ${intent.targetName}` : '') +
    ` | ${intent.reasoning}`,
  );

  // If no API key, use smart fallback
  const hasApiKey = !!(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);
  if (!hasApiKey) {
    logger.warn('No AI API key — using smart fallback reply');
    return {
      text: buildFallbackReply(input, intent),
      tokensUsed: 0,
      intent,
    };
  }

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(input, intent) },
      ],
      max_tokens: 250,
      temperature: 0.82,
    });

    const text = response.choices[0]?.message?.content?.trim() || buildFallbackReply(input, intent);
    const tokensUsed = response.usage?.total_tokens || 0;

    logger.info(
      `[Reply] Generated for ${posterName} [${MODEL}] tokens:${tokensUsed} | intent:${intent.intent}` +
      (intent.targetName ? ` | target:${intent.targetName}` : ''),
    );

    return { text, tokensUsed, intent };
  } catch (err) {
    logger.error('AI API error — falling back to template:', err);
    return {
      text: buildFallbackReply(input, intent),
      tokensUsed: 0,
      intent,
    };
  }
};
