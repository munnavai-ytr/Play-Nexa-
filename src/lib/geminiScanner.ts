// ── Play Nexa — Gemini AI Video Classifier ────────────────────
// Uses Google Gemini 1.5 Flash to classify YouTube videos
// as movie, music, or skip — with keyword fallback

import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_KEY = process.env.GEMINI_API_KEY || ''

let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI | null {
  if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_api_key_here') return null
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_KEY)
  }
  return genAI
}

export interface ScanResult {
  type: 'movie' | 'music' | 'skip'
  confidence: number
  reason: string
}

/**
 * Classify a YouTube video using Gemini 1.5 Flash.
 * Falls back to keyword-based classification if Gemini fails.
 */
export async function classifyVideo(
  title: string,
  description: string,
  channelName: string
): Promise<ScanResult> {
  const ai = getGenAI()

  if (!ai) {
    // No API key — use keyword fallback immediately
    return fallbackClassify(title, description)
  }

  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
    })

    const prompt = `You are a media classifier for a Bengali/Bangla streaming app called Play Nexa.

Analyze this YouTube video and classify it.

Video Title: "${title}"
Description: "${description.slice(0, 300)}"
Channel Name: "${channelName}"

Classification Rules:
MOVIE:
- Full movies, telefilms, web series episodes
- Keywords: full movie, official movie, full film, natok, telefilm, web series, short film, bangla movie, bengali movie
- Usually duration hints in title

MUSIC:
- Songs, music videos, audio tracks
- Keywords: song, music video, audio, lyrics, official song, music

SKIP:
- Trailers, teasers, behind the scenes
- Interviews, making of, promos
- News clips, shorts

Respond in valid JSON only, no extra text:
{
  "type": "movie" | "music" | "skip",
  "confidence": 0.95,
  "reason": "one line explanation"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Extract JSON safely — Gemini sometimes wraps in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const parsed = JSON.parse(jsonMatch[0])

    // Validate the parsed result
    const validTypes = ['movie', 'music', 'skip']
    const type = validTypes.includes(parsed.type) ? parsed.type : 'skip'
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0
    const reason = typeof parsed.reason === 'string' ? parsed.reason : ''

    return { type, confidence, reason }
  } catch {
    // Gemini failed — fall back to keywords
    return fallbackClassify(title, description)
  }
}

/**
 * Keyword-based fallback classifier.
 * Used when Gemini API is unavailable or returns invalid results.
 */
function fallbackClassify(
  title: string,
  description: string
): ScanResult {
  const text = `${title} ${description}`.toLowerCase()

  const movieKeywords = [
    'full movie', 'official movie', 'full film',
    'bangla movie', 'bengali movie', 'natok',
    'telefilm', 'web series', 'short film',
    'eid natok', 'special natok', 'bangla film',
    'bengali film', 'tele drama', 'drama',
  ]
  const musicKeywords = [
    'song', 'music video', 'audio', 'lyrics',
    'official song', 'official audio', 'music',
    'lyric video', 'acoustic', 'cover song',
    'bangla song', 'bengali song',
  ]
  const skipKeywords = [
    'trailer', 'teaser', 'making', 'interview',
    'behind the scene', 'promo', 'preview',
    '#shorts', 'shorts', 'news', 'vlog',
  ]

  // Check skip first — trailers and promos should not be imported
  if (skipKeywords.some(k => text.includes(k))) {
    return {
      type: 'skip',
      confidence: 0.9,
      reason: 'Skip keyword found',
    }
  }
  if (movieKeywords.some(k => text.includes(k))) {
    return {
      type: 'movie',
      confidence: 0.8,
      reason: 'Movie keyword found',
    }
  }
  if (musicKeywords.some(k => text.includes(k))) {
    return {
      type: 'music',
      confidence: 0.8,
      reason: 'Music keyword found',
    }
  }

  return {
    type: 'skip',
    confidence: 0.5,
    reason: 'No clear category matched',
  }
}
