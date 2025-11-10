import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pdfId = searchParams.get("pdf_id")

  if (!pdfId) {
    return NextResponse.json({ error: "PDF ID required" }, { status: 400 })
  }

  const { data: annotations, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("pdf_id", pdfId)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(annotations)
}
