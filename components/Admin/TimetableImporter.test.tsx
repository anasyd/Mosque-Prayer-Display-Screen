/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import TimetableImporter from "./TimetableImporter"

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
