"use client"

import { ChangeEvent, useState } from "react"
import { TimetableImportPreview } from "@/types/TimetableImportType"

const columns = [["fajr_start", "Fajr"], ["sunrise_start", "Sunrise"], ["zuhr_start", "Dhuhr"], ["asr_first_start", "Asr"], ["maghrib_start", "Maghrib"], ["isha_start", "Isha"]] as const

export default function TimetableImporter() {
  const [preview, setPreview] = useState<TimetableImportPreview | null>(null)
  const [fileName, setFileName] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name); setPreview(null); setMessage(null); setError(null); setBusy(true)
    try {
      const body = new FormData(); body.append("image", file)
      const response = await fetch("/api/admin/timetable", { method: "POST", body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not read the image")
      setPreview(data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read the image") }
    finally { setBusy(false) }
  }

  async function applyChanges() {
    if (!preview) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const response = await fetch("/api/admin/timetable", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(preview) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not update the sheet")
      setMessage(`Updated ${data.updatedCells} start-time cells across ${data.dates} dates.`); setPreview(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the sheet") }
    finally { setBusy(false) }
  }

  return (
    <section className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-[#f7faf8] shadow-[0_18px_55px_rgba(15,55,47,0.10)]">
      <div className="grid gap-8 bg-[#0c5a4b] px-6 py-8 text-white sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Prayer timetable</p><h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Bring a printed timetable into the sheet.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">Upload a clear timetable image. Gemini will read the Gregorian dates and prayer start times, then wait for your approval before anything is changed.</p></div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#f4c95d] px-5 py-3 text-sm font-bold text-[#17352f] transition hover:bg-[#ffe08c] focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#f4c95d]">{busy ? "Reading…" : "Choose timetable image"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleUpload} disabled={busy} /></label>
      </div>
      <div className="px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5 text-sm"><span className="font-medium text-slate-800">{fileName || "No image selected"}</span><span className="text-slate-500">Only start times are eligible for update.</span></div>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        {preview && <div className="mt-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Review before saving</p><p className="mt-1 text-sm text-slate-600">{preview.changes.length} dates detected{preview.sourceTitle ? ` · ${preview.sourceTitle}` : ""}</p></div><button type="button" onClick={applyChanges} disabled={busy} className="rounded-full bg-[#0c5a4b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#09483c] disabled:cursor-wait disabled:opacity-60">{busy ? "Saving…" : "Apply to Google Sheet"}</button></div><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-[#e7f0ed] text-xs uppercase tracking-[0.12em] text-[#315a52]"><tr><th className="px-4 py-3">Date</th>{columns.map(([, label]) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{preview.changes.map((change) => <tr key={change.date}><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{change.date}</td>{columns.map(([key]) => <td key={key} className="px-3 py-3 text-slate-600">{change.times[key] ?? <span className="text-amber-600">—</span>}</td>)}</tr>)}</tbody></table></div>{preview.warnings.length > 0 && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-semibold">Review warnings</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}<p className="mt-4 text-xs leading-5 text-slate-500">The importer never writes congregation/Jama’ah times. Check the preview carefully before applying it.</p></div>}
      </div>
    </section>
  )
}
