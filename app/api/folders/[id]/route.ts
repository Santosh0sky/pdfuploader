import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// DELETE a folder
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

    // Check if folder has subfolders
    const { data: subfolders, error: subfoldersError } = await supabase
      .from("folders")
      .select("id")
      .eq("parent_folder_id", id)
      .limit(1)

    if (subfoldersError) {
      return NextResponse.json({ error: subfoldersError.message }, { status: 500 })
    }

    if (subfolders && subfolders.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete folder with subfolders. Please delete subfolders first." },
        { status: 400 }
      )
    }

    // Move all PDFs in this folder to root (no folder) before deleting
    // This is handled automatically by the database because we set "on delete set null"
    // in the folder_id foreign key constraint

    // Delete the folder
    const { error } = await supabase.from("folders").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH update/rename a folder
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
    const { name, parent_folder_id } = body

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }

    // Prevent circular references (folder cannot be its own parent)
    if (parent_folder_id === id) {
      return NextResponse.json({ error: "Folder cannot be its own parent" }, { status: 400 })
    }

    const updateData: { name: string; parent_folder_id?: string | null } = {
      name: name.trim(),
    }

    if (parent_folder_id !== undefined) {
      updateData.parent_folder_id = parent_folder_id || null
    }

    const { data: folder, error } = await supabase
      .from("folders")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ folder })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
