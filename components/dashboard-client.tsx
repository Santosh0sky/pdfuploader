"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PDFUploadDialog } from "@/components/pdf-upload-dialog"
import { PDFList } from "@/components/pdf-list"
import { FolderManager } from "@/components/folder-manager"
import { CreatePDFFromFiles } from "@/components/create-pdf-from-files"
import { useRouter } from "next/navigation"

interface PDF {
  id: string
  filename: string
  file_path: string
  created_at: string
  folder_id: string | null
}

interface Folder {
  id: string
  name: string
  parent_folder_id: string | null
  created_at: string
}

interface DashboardClientProps {
  pdfs: PDF[]
  folders: Folder[]
}

export function DashboardClient({ pdfs, folders }: DashboardClientProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Filter PDFs based on selected folder
  const filteredPdfs = selectedFolderId === null
    ? pdfs
    : pdfs.filter((pdf) => pdf.folder_id === selectedFolderId)

  const handleFolderClick = (folderId: string | null) => {
    setSelectedFolderId(folderId)
  }

  const handlePdfDrop = async (pdfId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from("pdfs")
        .update({ folder_id: folderId })
        .eq("id", pdfId)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error moving PDF:", error)
      alert("Failed to move PDF to folder")
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar with folders */}
      <div className="lg:col-span-1">
        <div className="bg-card rounded-lg border p-4">
          <FolderManager
            folders={folders}
            onFolderClick={handleFolderClick}
            selectedFolderId={selectedFolderId}
            onPdfDrop={handlePdfDrop}
          />
        </div>
      </div>

      {/* Main content area with PDFs */}
      <div className="lg:col-span-3">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-semibold">
            {selectedFolderId === null
              ? "All PDFs"
              : folders.find((f) => f.id === selectedFolderId)?.name || "PDFs"}
          </h2>
          <div className="flex gap-2">
            <CreatePDFFromFiles onCreateSuccess={() => router.refresh()} />
            <PDFUploadDialog defaultFolderId={selectedFolderId} />
          </div>
        </div>

        {filteredPdfs && filteredPdfs.length > 0 ? (
          <PDFList pdfs={filteredPdfs} />
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border">
            <p className="text-muted-foreground mb-4">
              {selectedFolderId === null
                ? "No PDFs uploaded yet. Start by uploading your first PDF."
                : "No PDFs in this folder yet."}
            </p>
            <PDFUploadDialog defaultFolderId={selectedFolderId} />
          </div>
        )}
      </div>
    </div>
  )
}
