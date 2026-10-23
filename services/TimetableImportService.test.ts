jest.mock("@/services/GoogleSheetsService", () => ({ sheetsUpdatePrayerStartTimes: jest.fn() }))

process.env.GEMINI_API_KEY = "test-key"
import { extractTimetableFromImage } from "./TimetableImportService"

const valid = { candidates: [{ content: { parts: [{ text: JSON.stringify({ rows: [{ date: "2026-10-23", times: { fajr_start: "05:30" } }] }) }] } }] }
const reply = (status: number, body = {}) => ({ ok: status === 200, status, headers: new Headers({ "retry-after": "0" }), json: async () => body }) as Response

afterEach(() => jest.restoreAllMocks())

it("retries overloads and returns the timetable without exposing the API key in the URL", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(200, valid))
  const result = await extractTimetableFromImage(Buffer.from("image"), "image/png")
  expect(result.changes).toHaveLength(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[0][0]).not.toContain("test-key")
})

it("skips an unavailable model", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(reply(404)).mockResolvedValueOnce(reply(200, valid))
  await expect(extractTimetableFromImage(Buffer.from("image"), "image/png")).resolves.toHaveProperty("changes")
  expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0])
})

it("does not retry invalid credentials", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(reply(403))
  await expect(extractTimetableFromImage(Buffer.from("image"), "image/png")).rejects.toThrow("API key")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("falls back when the model returns an empty timetable", async () => {
  jest.spyOn(global, "fetch").mockResolvedValueOnce(reply(200, { candidates: [] })).mockResolvedValueOnce(reply(200, valid))
  await expect(extractTimetableFromImage(Buffer.from("image"), "image/png")).resolves.toHaveProperty("changes", [expect.objectContaining({ date: "2026-10-23" })])
})
