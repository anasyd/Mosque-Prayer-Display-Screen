import { PrayerStartKey, TimetableChange, TimetableImportPreview, TimetableTimes } from "@/types/TimetableImportType"

export const START_TIME_KEYS: PrayerStartKey[] = [
  "fajr_start", "sunrise_start", "zuhr_start", "asr_first_start", "maghrib_start", "isha_start",
]

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const time = `${match[1].padStart(2, "0")}:${match[2]}`
  return TIME_RE.test(time) ? time : null
}

export function parseGeminiTimetableResponse(raw: string): TimetableImportPreview {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const parsed = JSON.parse(cleaned) as { sourceTitle?: unknown; rows?: unknown; changes?: unknown }
  const rows = Array.isArray(parsed.rows) ? parsed.rows : parsed.changes
  if (!Array.isArray(rows)) throw new Error("Gemini returned no timetable rows")

  const warnings: string[] = []
  const changes: TimetableChange[] = []
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") { warnings.push(`Row ${index + 1} was not readable`); return }
    const candidate = row as Record<string, unknown>
    const date = typeof candidate.date === "string" ? candidate.date.trim() : ""
    if (!DATE_RE.test(date)) { warnings.push(`Row ${index + 1} has an invalid Gregorian date`); return }
    const inputTimes = candidate.times && typeof candidate.times === "object" ? candidate.times as Record<string, unknown> : candidate
    const times: TimetableTimes = {}
    for (const key of START_TIME_KEYS) {
      const value = normalizeTime(inputTimes[key])
      if (value) times[key] = value
      else if (inputTimes[key] != null && inputTimes[key] !== "") warnings.push(`${date}: ${key} was not a valid 24-hour time`)
    }
    if (Object.keys(times).length === 0) { warnings.push(`${date}: no valid prayer times found`); return }
    changes.push({
      date,
      times,
      confidence: typeof candidate.confidence === "number" ? candidate.confidence : undefined,
      notes: Array.isArray(candidate.notes) ? candidate.notes.filter((note): note is string => typeof note === "string") : undefined,
    })
  })
  return { sourceTitle: typeof parsed.sourceTitle === "string" ? parsed.sourceTitle : undefined, changes, warnings }
}

export function columnToLetters(columnIndex: number): string {
  let value = columnIndex + 1
  let letters = ""
  while (value > 0) { const remainder = (value - 1) % 26; letters = String.fromCharCode(65 + remainder) + letters; value = Math.floor((value - 1) / 26) }
  return letters
}

export interface SheetCellUpdate { range: string; value: string; date: string; key: PrayerStartKey }

export function buildSheetStartTimeUpdates(values: unknown[][], changes: TimetableChange[], sheetName = "PrayerTimes"): SheetCellUpdate[] {
  if (values.length === 0) throw new Error("The PrayerTimes sheet has no header row")
  const headers = values[0].map((header) => String(header ?? "").trim())
  const monthIndex = headers.indexOf("month")
  const dayIndex = headers.indexOf("day_of_month")
  if (monthIndex < 0 || dayIndex < 0) throw new Error("The PrayerTimes sheet is missing month/day_of_month columns")
  const rowByDate = new Map<string, number>()
  values.slice(1).forEach((row, index) => {
    const month = String(row[monthIndex] ?? "").trim()
    const day = String(row[dayIndex] ?? "").trim()
    if (month && day) rowByDate.set(`${month.padStart(2, "0")}-${day.padStart(2, "0")}`, index + 2)
  })
  return changes.flatMap((change) => {
    const match = change.date.match(/^\d{4}-(\d{2})-(\d{2})$/)
    if (!match) throw new Error(`${change.date} is not a valid Gregorian date`)
    const rowNumber = rowByDate.get(`${match[1]}-${match[2]}`)
    if (!rowNumber) throw new Error(`${change.date} was not found in the PrayerTimes sheet`)
    return START_TIME_KEYS.flatMap((key) => {
      const value = change.times[key]
      if (!value) return []
      const columnIndex = headers.indexOf(key)
      if (columnIndex < 0) throw new Error(`The PrayerTimes sheet is missing ${key}`)
      return [{ range: `'${sheetName}'!${columnToLetters(columnIndex)}${rowNumber}`, value, date: change.date, key }]
    })
  })
}
