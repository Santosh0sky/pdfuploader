"use client"

import type React from "react"

import { useState, useCallback } from "react"
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
import { Upload, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface PDFUploadDialogProps {
  onUploadSuccess?: () => void
}

export function PDFUploadDialog({ onUploadSuccess }: PDFUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const router = useRouter()

  const validateFile = (selectedFile: File): boolean => {
    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file")
      return false
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File size must be less than 50MB")
      return false
    }
    setError(null)
    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile)
    } else {
      setFile(null)
    }
  }

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile)
    } else {
      setFile(null)
    }
  }, [])

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
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-lg p-8 transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              isLoading && "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              {file ? (
                <>
                  <FileText className="h-12 w-12 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFile(null)}
                    disabled={isLoading}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <Upload className={cn(
                    "h-12 w-12 transition-colors",
                    isDragActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="text-sm font-medium">
                      {isDragActive ? "Drop PDF here" : "Drag & drop PDF file here"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <Input
                    id="pdf-file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>
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
