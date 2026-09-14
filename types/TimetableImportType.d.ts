export type PrayerStartKey =
  | "fajr_start"
  | "sunrise_start"
  | "zuhr_start"
  | "asr_first_start"
  | "maghrib_start"
  | "isha_start"

export type TimetableTimes = Partial<Record<PrayerStartKey, string>>

export interface TimetableChange {
  date: string
  times: TimetableTimes
  confidence?: number
  notes?: string[]
}

export interface TimetableImportPreview {
  sourceTitle?: string
  changes: TimetableChange[]
  warnings: string[]
}
