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

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { pdf_id, page_number, content } = body

    if (!pdf_id || page_number === undefined || !content) {
      return NextResponse.json(
        { error: "PDF ID, page number, and content are required" },
        { status: 400 }
      )
    }

    const { data: annotation, error } = await supabase
      .from("annotations")
      .insert({
        user_id: user.id,
        pdf_id,
        page_number,
        content,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(annotation, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
