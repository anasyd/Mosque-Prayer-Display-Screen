import { getSession } from "@/app/auth"
import { applyTimetableChanges, extractTimetableFromImage } from "@/services/TimetableImportService"
import { TimetableImportPreview } from "@/types/TimetableImportType"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

async function requireAdmin() {
  const session = await getSession()
  return session ? null : Response.json({ error: "You must be signed in" }, { status: 401 })
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const form = await request.formData()
  const file = form.get("image")
  if (!(file instanceof File)) return Response.json({ error: "Upload a timetable image" }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "Use a JPEG, PNG, WebP, HEIC, or HEIF image" }, { status: 415 })
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: "Images must be 10 MB or smaller" }, { status: 413 })
  try {
    const preview = await extractTimetableFromImage(Buffer.from(await file.arrayBuffer()), file.type)
    return Response.json(preview)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the timetable"
    return Response.json({ error: message }, { status: 502 })
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const preview = await request.json() as TimetableImportPreview
    return Response.json(await applyTimetableChanges(preview))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the spreadsheet"
    return Response.json({ error: message }, { status: 400 })
  }
}
