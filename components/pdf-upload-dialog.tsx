"use client"

import type React from "react"

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
import { useRouter } from "next/navigation"

interface PDFUploadDialogProps {
  onUploadSuccess?: () => void
}

export function PDFUploadDialog({ onUploadSuccess }: PDFUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
      // Get current user
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
