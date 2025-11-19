"use client"

import { useState } from "react"
import Link from "next/link"
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
import { useToast } from "@/hooks/use-toast"

// Import RTK Query hooks
import {
  useGetPdfsQuery,
  useGetFoldersQuery,
  useDeletePdfMutation,
  useUpdatePdfFolderMutation,
  type PDF,
} from "@/lib/redux"

export function PDFListRTK() {
  const { toast } = useToast()
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [movingPdf, setMovingPdf] = useState<PDF | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // RTK Query hooks - automatically fetch data with caching, loading states, and error handling
  const {
    data: pdfs = [],
    isLoading: pdfsLoading,
    error: pdfsError,
    refetch: refetchPdfs,
  } = useGetPdfsQuery()

  const {
    data: folders = [],
    isLoading: foldersLoading,
    error: foldersError,
  } = useGetFoldersQuery()

  // RTK Query mutations - optimistic updates and automatic cache invalidation
  const [deletePdf, { isLoading: isDeleting }] = useDeletePdfMutation()
  const [updatePdfFolder, { isLoading: isMoving }] = useUpdatePdfFolderMutation()

  const handleDelete = async (id: string) => {
    try {
      await deletePdf(id).unwrap()
      toast({
        title: "Success",
        description: "PDF deleted successfully",
      })
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete PDF",
        variant: "destructive",
      })
    }
  }

  const handleMoveToFolder = async () => {
    if (!movingPdf) return

    try {
      await updatePdfFolder({
        id: movingPdf.id,
        folder_id: selectedFolderId,
      }).unwrap()

      toast({
        title: "Success",
        description: "PDF moved successfully",
      })

      setIsMoveDialogOpen(false)
      setMovingPdf(null)
      setSelectedFolderId(null)
    } catch (error) {
      console.error("Move error:", error)
      toast({
        title: "Error",
        description: "Failed to move PDF",
        variant: "destructive",
      })
    }
  }

  if (pdfsLoading) {
    return <div className="text-center py-8">Loading PDFs...</div>
  }

  if (pdfsError) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading PDFs. Please try again.
      </div>
    )
  }

  if (pdfs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No PDFs uploaded yet. Upload your first PDF to get started!
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pdfs.map((pdf) => (
          <Card key={pdf.id}>
            <CardHeader>
              <CardTitle className="text-base truncate">{pdf.filename}</CardTitle>
              <CardDescription>
                {new Date(pdf.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/viewer/${pdf.id}`}>View</Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setMovingPdf(pdf)
                    setIsMoveDialogOpen(true)
                  }}
                  disabled={foldersLoading}
                >
                  <FolderInput className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(pdf.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move PDF to Folder</DialogTitle>
            <DialogDescription>
              Select a folder to move &quot;{movingPdf?.filename}&quot; to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder">Folder</Label>
              <Select
                value={selectedFolderId || "root"}
                onValueChange={(value) =>
                  setSelectedFolderId(value === "root" ? null : value)
                }
              >
                <SelectTrigger id="folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root (No folder)</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMoveToFolder}
                disabled={isMoving}
                className="flex-1"
              >
                {isMoving ? "Moving..." : "Move"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsMoveDialogOpen(false)
                  setMovingPdf(null)
                  setSelectedFolderId(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
