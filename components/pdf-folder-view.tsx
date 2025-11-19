"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Folder, FileText, Trash2, ChevronRight, ChevronDown, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface PDF {
  id: string
  filename: string
  file_path: string
  created_at: string
  folder_id: string | null
}

interface FolderType {
  id: string
  name: string
  color: string
  created_at: string
}

interface PDFFolderViewProps {
  pdfs: PDF[]
  folders: FolderType[]
}

export function PDFFolderView({ pdfs, folders }: PDFFolderViewProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [draggedPdfId, setDraggedPdfId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleDeletePdf = async (pdfId: string, filePath: string) => {
    if (!confirm("Are you sure you want to delete this PDF?")) return

    setIsDeleting(pdfId)
    try {
      await supabase.storage.from("pdfs").remove([filePath])
      await supabase.from("pdfs").delete().eq("id", pdfId)
      router.refresh()
    } catch (error) {
      console.error("Error deleting PDF:", error)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure you want to delete this folder? PDFs will be moved to root.")) return

    try {
      await fetch(`/api/folders/${folderId}`, { method: "DELETE" })
      router.refresh()
    } catch (error) {
      console.error("Error deleting folder:", error)
    }
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Drag and Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, pdfId: string) => {
    setDraggedPdfId(pdfId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", pdfId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedPdfId(null)
    setDragOverFolderId(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const handleDragEnterFolder = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    setDragOverFolderId(folderId)
  }, [])

  const handleDragLeaveFolder = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Only reset if leaving to outside
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null)
    }
  }, [])

  const handleDropOnFolder = useCallback(async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    const pdfId = e.dataTransfer.getData("text/plain")

    if (!pdfId || pdfId === draggedPdfId) {
      setDraggedPdfId(null)
      setDragOverFolderId(null)

      try {
        await supabase
          .from("pdfs")
          .update({ folder_id: folderId })
          .eq("id", pdfId)

        router.refresh()
      } catch (error) {
        console.error("Error moving PDF:", error)
      }
    }

    setDraggedPdfId(null)
    setDragOverFolderId(null)
  }, [draggedPdfId, supabase, router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Get PDFs not in any folder
  const rootPdfs = pdfs.filter((pdf) => !pdf.folder_id)

  // Get PDFs for a specific folder
  const getPdfsInFolder = (folderId: string) => {
    return pdfs.filter((pdf) => pdf.folder_id === folderId)
  }

  const PDFCard = ({ pdf }: { pdf: PDF }) => (
    <Card
      key={pdf.id}
      draggable
      onDragStart={(e) => handleDragStart(e, pdf.id)}
      onDragEnd={handleDragEnd}
      className={cn(
        "hover:shadow-lg transition-all cursor-grab active:cursor-grabbing",
        draggedPdfId === pdf.id && "opacity-50"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
            <CardTitle className="truncate text-base">{pdf.filename}</CardTitle>
          </div>
        </div>
        <CardDescription className="text-xs">{formatDate(pdf.created_at)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Link href={`/viewer/${pdf.id}`} className="flex-1">
            <Button variant="default" className="w-full">
              View
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => handleDeletePdf(pdf.id, pdf.file_path)}
            disabled={isDeleting === pdf.id}
          >
            {isDeleting === pdf.id ? "..." : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="space-y-4">
          {folders.map((folder) => {
            const folderPdfs = getPdfsInFolder(folder.id)
            const isExpanded = expandedFolders.has(folder.id)
            const isDragOver = dragOverFolderId === folder.id

            return (
              <div key={folder.id} className="space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnterFolder(e, folder.id)}
                  onDragLeave={handleDragLeaveFolder}
                  onDrop={(e) => handleDropOnFolder(e, folder.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    isDragOver
                      ? "border-primary bg-primary/10 border-dashed border-2"
                      : "border-border bg-card hover:bg-accent/50"
                  )}
                >
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center gap-2 flex-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Folder className="h-5 w-5" style={{ color: folder.color || '#6366f1' }} />
                    <span className="font-medium">{folder.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({folderPdfs.length} {folderPdfs.length === 1 ? "file" : "files"})
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isExpanded && folderPdfs.length > 0 && (
                  <div className="ml-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {folderPdfs.map((pdf) => (
                      <PDFCard key={pdf.id} pdf={pdf} />
                    ))}
                  </div>
                )}

                {isExpanded && folderPdfs.length === 0 && (
                  <div className="ml-6 p-4 text-center text-muted-foreground border border-dashed rounded-lg">
                    Drag PDFs here to add them to this folder
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Root PDFs Section (not in any folder) */}
      {rootPdfs.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnterFolder(e, null)}
          onDragLeave={handleDragLeaveFolder}
          onDrop={(e) => handleDropOnFolder(e, null)}
          className={cn(
            "space-y-4",
            dragOverFolderId === null && draggedPdfId && "p-4 border-2 border-dashed border-primary bg-primary/5 rounded-lg"
          )}
        >
          {folders.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground">Unfiled Documents</h3>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rootPdfs.map((pdf) => (
              <PDFCard key={pdf.id} pdf={pdf} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pdfs.length === 0 && folders.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border">
          <p className="text-muted-foreground mb-4">
            No PDFs uploaded yet. Start by uploading your first PDF.
          </p>
        </div>
      )}
    </div>
  )
}
