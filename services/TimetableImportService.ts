import { parseGeminiTimetableResponse } from "@/lib/timetableImport"
import { sheetsUpdatePrayerStartTimes } from "@/services/GoogleSheetsService"
import { TimetableImportPreview } from "@/types/TimetableImportType"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ""
// Keep this configurable because Gemini model names and availability can change.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash"

const GEMINI_PROMPT = `Read this prayer timetable image and return ONLY valid JSON.
Use the visible Gregorian date in each row as the source of truth. Do not infer or shift dates using Hijri dates.
Return this exact shape: {"sourceTitle":"optional title","rows":[{"date":"YYYY-MM-DD","times":{"fajr_start":"HH:mm","sunrise_start":"HH:mm","zuhr_start":"HH:mm","asr_first_start":"HH:mm","maghrib_start":"HH:mm","isha_start":"HH:mm"},"confidence":0.0,"notes":[]}]}
Times must be 24-hour HH:mm. Use null for an unreadable cell. Never include congregation or Jama'ah times.`

export async function extractTimetableFromImage(image: Buffer, mimeType: string): Promise<TimetableImportPreview> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY has not been configured")
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: GEMINI_PROMPT }, { inlineData: { mimeType, data: image.toString("base64") } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
  })
  if (!response.ok) { const message = await response.text(); throw new Error(`Gemini request failed (${response.status}): ${message.slice(0, 300)}`) }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")
  if (!text) throw new Error("Gemini returned an empty timetable")
  return parseGeminiTimetableResponse(text)
}

export async function applyTimetableChanges(preview: TimetableImportPreview) {
  if (preview.changes.length === 0) throw new Error("There are no valid timetable changes to apply")
  const updatedCells = await sheetsUpdatePrayerStartTimes(preview.changes)
  return { updatedCells, dates: new Set(preview.changes.map((change) => change.date)).size }
}
