"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Folder, FolderPlus, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface FolderData {
  id: string
  name: string
  parent_folder_id: string | null
  created_at: string
}

interface FolderManagerProps {
  folders: FolderData[]
  onFolderClick?: (folderId: string | null) => void
  selectedFolderId?: string | null
  onPdfDrop?: (pdfId: string, folderId: string | null) => Promise<void>
}

export function FolderManager({ folders, onFolderClick, selectedFolderId, onPdfDrop }: FolderManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [editingFolder, setEditingFolder] = useState<FolderData | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<FolderData | null>(null)
  const [folderFileCount, setFolderFileCount] = useState<number>(0)
  const [folderSubfolderCount, setFolderSubfolderCount] = useState<number>(0)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) {
      setError("Folder name is required")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_folder_id: null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create folder")
      }

      setNewFolderName("")
      setIsCreateOpen(false)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create folder")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFolder || !editingFolder.name.trim()) {
      setError("Folder name is required")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/folders/${editingFolder.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingFolder.name.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to rename folder")
      }

      setEditingFolder(null)
      setIsEditOpen(false)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename folder")
    } finally {
      setIsLoading(false)
    }
  }

  const openDeleteDialog = async (folder: FolderData) => {
    setDeletingFolder(folder)
    setError(null)

    // Count PDFs in this folder
    const { count: pdfCount } = await supabase
      .from("pdfs")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", folder.id)

    // Count subfolders
    const { count: subfolderCount } = await supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("parent_folder_id", folder.id)

    setFolderFileCount(pdfCount || 0)
    setFolderSubfolderCount(subfolderCount || 0)
    setIsDeleteOpen(true)
  }

  const handleDeleteFolder = async () => {
    if (!deletingFolder) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/folders/${deletingFolder.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete folder")
      }

      setIsDeleteOpen(false)
      setDeletingFolder(null)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete folder")
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (folder: FolderData) => {
    setEditingFolder({ ...folder })
    setError(null)
    setIsEditOpen(true)
  }

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)

    const pdfId = e.dataTransfer.getData("pdfId")
    if (pdfId && onPdfDrop) {
      await onPdfDrop(pdfId, folderId)
    }
  }

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(folderId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Folder className="h-5 w-5" />
          Folders
        </h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>Enter a name for your new folder</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="folder-name">Folder Name</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My Folder"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        <Card
          className={`cursor-pointer hover:bg-slate-50 transition-all ${
            selectedFolderId === null ? "border-blue-500 bg-blue-50" : ""
          } ${dragOverFolderId === "root" ? "border-green-500 bg-green-50 scale-105" : ""}`}
          onClick={() => onFolderClick?.(null)}
          onDrop={(e) => handleDrop(e, null)}
          onDragOver={(e) => handleDragOver(e, "root")}
          onDragLeave={handleDragLeave}
        >
          <CardHeader className="p-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Folder className="h-4 w-4" />
              All PDFs
            </CardTitle>
          </CardHeader>
        </Card>

        {folders.map((folder) => (
          <Card
            key={folder.id}
            className={`cursor-pointer hover:bg-slate-50 transition-all ${
              selectedFolderId === folder.id ? "border-blue-500 bg-blue-50" : ""
            } ${dragOverFolderId === folder.id ? "border-green-500 bg-green-50 scale-105" : ""}`}
            onClick={() => onFolderClick?.(folder.id)}
            onDrop={(e) => handleDrop(e, folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
          >
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  {folder.name}
                </CardTitle>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(folder)}
                    disabled={isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDeleteDialog(folder)}
                    disabled={isLoading}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>Enter a new name for this folder</DialogDescription>
          </DialogHeader>
          {editingFolder && (
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-folder-name">Folder Name</Label>
                <Input
                  id="edit-folder-name"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                  placeholder="My Folder"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {folderSubfolderCount > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-red-900">Cannot Delete</p>
                <div className="text-sm text-red-800">
                  <p>
                    This folder contains <strong>{folderSubfolderCount}</strong> subfolder{folderSubfolderCount !== 1 ? "s" : ""}.
                  </p>
                  <p className="mt-2">
                    You must delete all subfolders before deleting this folder.
                  </p>
                </div>
              </div>
            ) : folderFileCount > 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-yellow-900">Warning</p>
                <div className="text-sm text-yellow-800">
                  <p>
                    This folder contains <strong>{folderFileCount}</strong> PDF{folderFileCount !== 1 ? "s" : ""}.
                  </p>
                  <p className="mt-2">
                    All PDFs will be moved to the root folder (no folder) when this folder is deleted.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  This folder is empty and will be permanently deleted.
                </p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteFolder}
                disabled={isLoading || folderSubfolderCount > 0}
              >
                {isLoading ? "Deleting..." : "Delete Folder"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
