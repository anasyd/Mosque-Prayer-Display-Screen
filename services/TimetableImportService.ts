import { parseGeminiTimetableResponse } from "@/lib/timetableImport"
import { sheetsUpdatePrayerStartTimes } from "@/services/GoogleSheetsService"
import { TimetableImportPreview } from "@/types/TimetableImportType"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ""
// Keep this configurable because Gemini model names and availability can change.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash"
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.7-flash,gemini-3.6-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean)

const GEMINI_PROMPT = `Read this prayer timetable image and return ONLY valid JSON.
Use the visible Gregorian date in each row as the source of truth. Do not infer or shift dates using Hijri dates.
Return this exact shape: {"sourceTitle":"optional title","rows":[{"date":"YYYY-MM-DD","times":{"fajr_start":"HH:mm","sunrise_start":"HH:mm","zuhr_start":"HH:mm","asr_first_start":"HH:mm","maghrib_start":"HH:mm","isha_start":"HH:mm"},"confidence":0.0,"notes":[]}]}
Times must be 24-hour HH:mm. Use null for an unreadable cell. Never include congregation or Jama'ah times.`

export async function extractTimetableFromImage(image: Buffer, mimeType: string): Promise<TimetableImportPreview> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY has not been configured")
  const models = [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])]
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: GEMINI_PROMPT }, { inlineData: { mimeType, data: image.toString("base64") } }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  })
  let lastError = "Gemini request failed"

  // Keep the entire operation within the route's execution budget.
  const deadline = Date.now() + 110_000
  for (const model of models) {
    for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
      let response: Response
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: requestBody,
          signal: AbortSignal.timeout(Math.min(25_000, deadline - Date.now())),
        })
      } catch {
        lastError = `Gemini timed out or could not be reached using ${model}. Please retry.`
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt + Math.random() * 250))
        continue
      }

      if (response.ok) {
        const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }
        const text = payload.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("")
        try {
          if (!text) throw new Error("No readable timetable returned")
          const preview = parseGeminiTimetableResponse(text)
          if (!preview.changes.length) throw new Error("No valid timetable rows returned")
          return preview
        } catch {
          lastError = `Gemini returned an incomplete or unreadable timetable using ${model}. Try a clearer image.`
          break
        }
      }

      lastError = `Gemini request failed (${response.status}) using ${model}.`
      if (response.status === 401 || response.status === 403 || response.status === 400) {
        throw new Error(`${lastError} Check the Gemini API key, billing, and model configuration.`)
      }
      if (response.status === 404) break
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw new Error(lastError)
      lastError += " The service is busy or its quota is exhausted. Please retry shortly."
      if (attempt < 2) {
        const retryAfter = response.headers.get("retry-after")
        const delay = retryAfter ? Number(retryAfter) * 1000 : 1000 * 2 ** attempt + Math.random() * 250
        // Long quota cooldowns should fall back instead of holding the request open.
        if (!Number.isFinite(delay) || delay > 5000 || Date.now() + delay >= deadline) break
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(lastError)
}

export async function applyTimetableChanges(preview: TimetableImportPreview) {
  if (preview.changes.length === 0) throw new Error("There are no valid timetable changes to apply")
  const updatedCells = await sheetsUpdatePrayerStartTimes(preview.changes)
  return { updatedCells, dates: new Set(preview.changes.map((change) => change.date)).size }
}
