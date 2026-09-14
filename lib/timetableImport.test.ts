import { buildSheetStartTimeUpdates, normalizeTime, parseGeminiTimetableResponse } from "@/lib/timetableImport"

describe("timetable import", () => {
  it("normalizes supported timetable times", () => {
    expect(normalizeTime("5:17")).toBe("05:17")
    expect(normalizeTime("05:17:00")).toBe("05:17")
    expect(normalizeTime("25:17")).toBeNull()
  })

  it("parses Gregorian rows and ignores congregation fields", () => {
    const result = parseGeminiTimetableResponse(JSON.stringify({ rows: [{ date: "2026-09-14", times: { fajr_start: "05:17", sunrise_start: "06:49", zuhr_start: "13:17", asr_first_start: "17:33", maghrib_start: "19:36", isha_start: "20:50", fajr_congregation_start: "06:00" } }] }))
    expect(result.changes[0].times).toEqual({ fajr_start: "05:17", sunrise_start: "06:49", zuhr_start: "13:17", asr_first_start: "17:33", maghrib_start: "19:36", isha_start: "20:50" })
  })

  it("creates only start-time cell updates for matching month/day rows", () => {
    const updates = buildSheetStartTimeUpdates([
      ["month", "day_of_month", "fajr_start", "fajr_congregation_start", "sunrise_start", "zuhr_start", "zuhr_congregation_start", "asr_first_start", "asr_congregation_start", "maghrib_start", "maghrib_congregation_start", "isha_start", "isha_congregation_start"],
      ["9", "14", "06:00", "07:00", "07:00", "13:00", "13:30", "17:00", "17:30", "19:00", "19:10", "20:00", "20:30"],
    ], [{ date: "2026-09-14", times: { fajr_start: "05:17", sunrise_start: "06:49", zuhr_start: "13:17", asr_first_start: "17:33", maghrib_start: "19:36", isha_start: "20:50" } }])
    expect(updates).toHaveLength(6)
    expect(updates.every((update) => !update.key.includes("congregation"))).toBe(true)
    expect(updates.map((update) => update.range)).toEqual(["'PrayerTimes'!C2", "'PrayerTimes'!E2", "'PrayerTimes'!F2", "'PrayerTimes'!H2", "'PrayerTimes'!J2", "'PrayerTimes'!L2"])
  })
})
