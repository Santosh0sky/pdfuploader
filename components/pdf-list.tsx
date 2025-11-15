"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { FolderInput } from "lucide-react"
import { useRouter } from "next/navigation"

interface PDF {
  id: string
  filename: string
  file_path: string
  created_at: string
  folder_id?: string | null
}

interface Folder {
  id: string
  name: string
}

interface PDFListProps {
  pdfs: PDF[]
}

export function PDFList({ pdfs }: PDFListProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [movingPdf, setMovingPdf] = useState<PDF | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [isMoving, setIsMoving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    const { data } = await supabase.from("folders").select("id, name").order("name", { ascending: true })
    if (data) {
      setFolders(data)
    }
  }

  const handleDelete = async (pdfId: string, filePath: string) => {
    if (!confirm("Are you sure you want to delete this PDF?")) return

    setIsDeleting(pdfId)
    try {
      // Delete from storage
      await supabase.storage.from("pdfs").remove([filePath])

      // Delete from database
      await supabase.from("pdfs").delete().eq("id", pdfId)

      router.refresh()
    } catch (error) {
      console.error("[v0] Error deleting PDF:", error)
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const openMoveDialog = (pdf: PDF) => {
    setMovingPdf(pdf)
    setSelectedFolderId(pdf.folder_id || null)
    setIsMoveDialogOpen(true)
  }

  const handleMovePdf = async () => {
    if (!movingPdf) return

    setIsMoving(true)
    try {
      const { error } = await supabase
        .from("pdfs")
        .update({ folder_id: selectedFolderId })
        .eq("id", movingPdf.id)

      if (error) throw error

      setIsMoveDialogOpen(false)
      setMovingPdf(null)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error moving PDF:", error)
      alert("Failed to move PDF")
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pdfs.map((pdf) => (
          <Card
            key={pdf.id}
            className="hover:shadow-lg transition-shadow cursor-move"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("pdfId", pdf.id)
              e.dataTransfer.setData("pdfName", pdf.filename)
              e.dataTransfer.effectAllowed = "move"
              e.currentTarget.style.opacity = "0.5"
            }}
            onDragEnd={(e) => {
              e.currentTarget.style.opacity = "1"
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="truncate text-base">{pdf.filename}</CardTitle>
              <CardDescription className="text-xs">{formatDate(pdf.created_at)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Link href={`/viewer/${pdf.id}`} className="flex-1">
                  <Button variant="default" className="w-full">
                    View
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(pdf.id, pdf.file_path)}
                  disabled={isDeleting === pdf.id}
                >
                  {isDeleting === pdf.id ? "..." : "Delete"}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMoveDialog(pdf)}
                className="w-full"
              >
                <FolderInput className="h-3 w-3 mr-2" />
                Move to Folder
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move PDF to Folder</DialogTitle>
            <DialogDescription>
              Select a folder to move "{movingPdf?.filename}" to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="move-folder">Folder</Label>
              <Select
                value={selectedFolderId || "none"}
                onValueChange={(value) => setSelectedFolderId(value === "none" ? null : value)}
              >
                <SelectTrigger id="move-folder">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMoveDialogOpen(false)}
                disabled={isMoving}
              >
                Cancel
              </Button>
              <Button onClick={handleMovePdf} disabled={isMoving}>
                {isMoving ? "Moving..." : "Move"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
