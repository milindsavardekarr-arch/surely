/**
 * Image Vision Service
 *
 * WhatsApp image status ko AI se read karke text description banata hai.
 * Yeh description phir event detection mein use hoti hai.
 *
 * Flow:
 *   Image URL (Baileys/Meta) → Download as base64 → GPT-4o-mini Vision → Description → detectEvent()
 *
 * Models supported:
 *   - openai/gpt-4o-mini     (best, needs OpenAI key)
 *   - meta-llama/llama-4-scout-17b-16e-instruct  (Groq free tier, vision support)
 */

import OpenAI from 'openai';
import axios from 'axios';
import { logger } from '../../utils/logger';

// Vision client — OpenAI by default, falls back to Groq llama-4-scout (has vision)
function getVisionClient(): { client: OpenAI; model: string } {
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const groqKey   = process.env.GROQ_API_KEY || '';

  // If explicit OpenAI key (starts with sk-) and OpenAI base URL → use GPT-4o-mini
  const isOpenAI = openaiKey.startsWith('sk-') && (
    !process.env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL.includes('openai.com')
  );

  if (isOpenAI) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.VISION_MODEL || 'gpt-4o-mini',
    };
  }

  // Groq — llama-4-scout supports vision
  return {
    client: new OpenAI({
      apiKey: groqKey || openaiKey,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
    }),
    model: process.env.VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  };
}

export interface VisionResult {
  description: string;      // Full image description for event detection
  detectedText: string;     // Any text found in image (OCR-like)
  eventHints: string[];     // Keywords/hints useful for event detection
  confidence: 'high' | 'medium' | 'low';
  eventType?: string;       // Direct event classification from vision model
  error?: string;
}

// ── Download image URL to base64 ──────────────────────────────────────────────
async function urlToBase64(imageUrl: string, authToken?: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    const base64 = Buffer.from(response.data).toString('base64');

    return { base64, mimeType };
  } catch (err) {
    logger.error('[ImageVision] Failed to download image:', (err as Error).message);
    return null;
  }
}

// ── Main vision analysis ───────────────────────────────────────────────────────
export async function analyzeImageStatus(
  imageSource: string,   // URL or base64 string
  caption?: string,      // Optional caption from WhatsApp
  authToken?: string,    // Meta API token for downloading (if needed)
): Promise<VisionResult> {
  try {
    let base64: string;
    let mimeType = 'image/jpeg';

    // If already base64
    if (imageSource.startsWith('data:')) {
      const parts = imageSource.split(',');
      mimeType = parts[0].replace('data:', '').replace(';base64', '');
      base64 = parts[1];
    } else if (!imageSource.startsWith('http')) {
      base64 = imageSource; // raw base64
    } else {
      // Download from URL
      const downloaded = await urlToBase64(imageSource, authToken);
      if (!downloaded) {
        return {
          description: caption || 'Image status (could not download)',
          detectedText: caption || '',
          eventHints: caption ? [caption] : [],
          confidence: 'low',
          error: 'Image download failed',
        };
      }
      base64 = downloaded.base64;
      mimeType = downloaded.mimeType;
    }

    const { client, model } = getVisionClient();

    const systemPrompt = `You are analyzing WhatsApp status images to understand what life event or moment the person is sharing.

Your job: Look at the image carefully and provide:
1. A brief description of what you see
2. Any text visible in the image (OCR)
3. The life event or emotion it represents

Be specific about events: birthday, wedding, anniversary, job promotion, new baby, new home, festival, travel, graduation, etc.
Also detect emotions: happy, sad, excited, grateful, proud, celebrating.

${caption ? `The user also wrote this caption: "${caption}"` : ''}

Respond in this exact JSON format:
{
  "description": "what is shown in the image",
  "detectedText": "any text visible in image",
  "eventHints": ["keyword1", "keyword2", "event type"],
  "confidence": "high|medium|low",
  "eventType": "BIRTHDAY|ANNIVERSARY|ACHIEVEMENT|FESTIVAL|SAD_EMOTION|POSITIVE|OTHER"
}`;

    logger.info(`[ImageVision] Analyzing image with model: ${model}`);

    const response = await client.chat.completions.create({
      model,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'low', // faster + cheaper
              },
            },
            {
              type: 'text',
              text: systemPrompt,
            },
          ],
        },
      ],
    });

    const rawText = response.choices[0]?.message?.content || '';
    logger.info(`[ImageVision] Raw response: ${rawText.substring(0, 200)}`);

    // Parse JSON response
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Merge caption into event hints
      const eventHints: string[] = parsed.eventHints || [];
      if (caption && caption.length > 2) eventHints.push(caption);
      if (parsed.detectedText) eventHints.push(parsed.detectedText);

      return {
        description: parsed.description || caption || 'Image status',
        detectedText: parsed.detectedText || '',
        eventHints: [...new Set(eventHints)],
        confidence: parsed.confidence || 'medium',
        eventType: parsed.eventType || undefined,
      };
    } catch {
      // If JSON parse fails, use raw text as description
      const combined = [rawText, caption].filter(Boolean).join(' ');
      return {
        description: combined,
        detectedText: rawText,
        eventHints: caption ? [caption] : [],
        confidence: 'low',
      };
    }
  } catch (err) {
    const error = err as Error & { status?: number };
    logger.error('[ImageVision] Analysis failed:', error.message);

    // Graceful fallback — use caption if available
    return {
      description: caption || 'Image status',
      detectedText: caption || '',
      eventHints: caption ? [caption] : [],
      confidence: 'low',
      error: error.message,
    };
  }
}

// ── Build enriched status text for event detection ─────────────────────────────
// Combines original caption + vision description into one text for detectEvent()
export function buildEnrichedStatusText(
  originalText: string,
  visionResult: VisionResult,
): string {
  const parts: string[] = [];

  if (originalText && originalText !== '[Image Status]' && originalText !== '[Video Status]') {
    parts.push(originalText);
  }
  if (visionResult.description) parts.push(visionResult.description);
  if (visionResult.detectedText) parts.push(visionResult.detectedText);
  if (visionResult.eventHints.length > 0) parts.push(visionResult.eventHints.join(' '));

  return parts.join(' | ');
}
