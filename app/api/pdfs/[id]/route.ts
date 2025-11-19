import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// DELETE a PDF
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the PDF to delete the file from storage
    const { data: pdf, error: fetchError } = await supabase
      .from("pdfs")
      .select("file_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !pdf) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 })
    }

    // Delete the file from storage
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .remove([pdf.file_path])

    if (storageError) {
      console.error("Storage deletion error:", storageError)
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error } = await supabase.from("pdfs").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PDF deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH update a PDF (e.g., move to folder)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { folder_id } = body

    const { data: pdf, error } = await supabase
      .from("pdfs")
      .update({ folder_id: folder_id || null })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(pdf)
  } catch (error) {
    console.error("PDF update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
