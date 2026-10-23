/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import TimetableImporter from "./TimetableImporter"

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); jest.restoreAllMocks() })

it("retries saving the existing preview instead of extracting the image again", async () => {
  const preview = { changes: [{ date: "2026-10-23", times: { fajr_start: "05:30" } }], warnings: [] }
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => preview })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Sheets unavailable" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ updatedCells: 1, dates: 1 }) })
  render(<TimetableImporter />)
  fireEvent.change(screen.getByLabelText("Choose timetable image"), { target: { files: [new File(["image"], "timetable.png", { type: "image/png" })] } })
  fireEvent.click(await screen.findByRole("button", { name: "Apply to Google Sheet" }))
  fireEvent.click(await screen.findByRole("button", { name: "Retry saving" }))
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Updated 1"))
  expect((global.fetch as jest.Mock).mock.calls.map((call) => call[1].method)).toEqual(["POST", "PUT", "PUT"])
  expect((global.fetch as jest.Mock).mock.calls[2][1].body).toBe(JSON.stringify(preview))
})

const draftKey = "timetable-import-draft-v1"
const savedPreview = { changes: [{ date: "2026-10-23", times: { fajr_start: "05:30" } }], warnings: ["Check the source image"] }

it("restores a generated draft after leaving the page and retains it after a failed save", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => savedPreview })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Sheets unavailable" }) })
  const view = render(<TimetableImporter />)
  fireEvent.change(screen.getByLabelText("Choose timetable image"), { target: { files: [new File(["image"], "saved.png", { type: "image/png" })] } })
  await screen.findByRole("button", { name: "Apply to Google Sheet" })
  expect(JSON.parse(localStorage.getItem(draftKey)!).preview).toEqual(savedPreview)
  view.unmount()
  render(<TimetableImporter />)
  expect(await screen.findByText("saved.png")).toBeTruthy()
  expect(screen.getByText("05:30")).toBeTruthy()
  expect(screen.getByText("Check the source image")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Apply to Google Sheet" }))
  await screen.findByRole("button", { name: "Retry saving" })
  expect(localStorage.getItem(draftKey)).not.toBeNull()
  expect(global.fetch).toHaveBeenCalledTimes(2)
})

it("clears the browser draft after a successful save", async () => {
  localStorage.setItem(draftKey, JSON.stringify({ preview: savedPreview, fileName: "saved.png" }))
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ updatedCells: 1, dates: 1 }) })
  render(<TimetableImporter />)
  fireEvent.click(await screen.findByRole("button", { name: "Apply to Google Sheet" }))
  await waitFor(() => expect(localStorage.getItem(draftKey)).toBeNull())
  expect(screen.queryByRole("table")).toBeNull()
})

it("allows a saved draft to be discarded", async () => {
  localStorage.setItem(draftKey, JSON.stringify({ preview: savedPreview }))
  render(<TimetableImporter />)
  fireEvent.click(await screen.findByRole("button", { name: "Discard saved table" }))
  expect(localStorage.getItem(draftKey)).toBeNull()
  expect(screen.queryByRole("table")).toBeNull()
})

it("keeps extraction usable when browser storage is blocked", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked") })
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => savedPreview })
  render(<TimetableImporter />)
  fireEvent.change(screen.getByLabelText("Choose timetable image"), { target: { files: [new File(["image"], "saved.png", { type: "image/png" })] } })
  await screen.findByRole("button", { name: "Apply to Google Sheet" })
  expect(screen.getByRole("alert").textContent).toContain("Keep this page open")
})
