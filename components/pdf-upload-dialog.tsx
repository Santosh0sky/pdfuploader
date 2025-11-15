"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"

interface Folder {
  id: string
  name: string
  parent_folder_id: string | null
}

interface PDFUploadDialogProps {
  onUploadSuccess?: () => void
  defaultFolderId?: string | null
}

export function PDFUploadDialog({ onUploadSuccess, defaultFolderId }: PDFUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(defaultFolderId || null)
  const router = useRouter()

  // Load folders when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadFolders()
    }
  }, [isOpen])

  const loadFolders = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("folders").select("*").order("name", { ascending: true })
    if (data) {
      setFolders(data)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        setError("Please select a PDF file")
        setFile(null)
        return
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("File size must be less than 50MB")
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a file")
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // Get authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error("Not authenticated")

      // Upload file to Supabase Storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from("pdfs").upload(filePath, file)

      if (uploadError) throw uploadError

      // Create PDF record in database
      const { error: dbError } = await supabase.from("pdfs").insert({
        user_id: user.id,
        filename: file.name,
        file_path: filePath,
        folder_id: selectedFolderId,
      })

      if (dbError) throw dbError

      setFile(null)
      setIsOpen(false)
      onUploadSuccess?.()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Upload PDF</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload PDF</DialogTitle>
          <DialogDescription>Select a PDF file to upload. Maximum file size is 50MB.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="pdf-file">Select PDF File</Label>
            <Input id="pdf-file" type="file" accept=".pdf" onChange={handleFileChange} disabled={isLoading} />
            {file && <p className="text-sm text-muted-foreground">Selected: {file.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="folder">Folder (Optional)</Label>
            <Select value={selectedFolderId || "none"} onValueChange={(value) => setSelectedFolderId(value === "none" ? null : value)}>
              <SelectTrigger id="folder">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !file}>
              {isLoading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
