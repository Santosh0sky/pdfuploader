"use client"

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
import { useToast } from "@/hooks/use-toast"
import { Loader2, FilePlus2, X, Upload } from "lucide-react"
import { PDFDocument } from "pdf-lib"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface CreatePDFFromFilesProps {
  onCreateSuccess?: () => void
}

export function CreatePDFFromFiles({ onCreateSuccess }: CreatePDFFromFilesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [pdfName, setPdfName] = useState("")

  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  const acceptedTypes = {
    images: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
    // Note: For docs and ppt, we'll need server-side conversion or use browser's print to PDF
    // For now, we'll focus on images which can be converted client-side
  }

  const allAcceptedTypes = [...acceptedTypes.images]

  const validateFile = (file: File): boolean => {
    if (!allAcceptedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Please select images (JPG, PNG, GIF, WEBP)`,
        variant: "destructive",
      })
      return false
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `${file.name} exceeds 20MB limit`,
        variant: "destructive",
      })
      return false
    }
    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.filter(validateFile)
    setFiles((prev) => [...prev, ...validFiles])
  }

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

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.filter(validateFile)
    setFiles((prev) => [...prev, ...validFiles])
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const imageToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const embedImageInPdf = async (pdfDoc: PDFDocument, dataUrl: string, fileType: string) => {
    let image
    if (fileType.includes("png")) {
      image = await pdfDoc.embedPng(dataUrl)
    } else if (fileType.includes("jpg") || fileType.includes("jpeg")) {
      image = await pdfDoc.embedJpg(dataUrl)
    } else {
      // For other formats, convert to PNG first using canvas
      const img = new Image()
      await new Promise((resolve) => {
        img.onload = resolve
        img.src = dataUrl
      })

      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const pngDataUrl = canvas.toDataURL("image/png")
      image = await pdfDoc.embedPng(pngDataUrl)
    }

    return image
  }

  const createPdfFromImages = async () => {
    if (files.length === 0) {
      toast({ title: "No files", description: "Please add at least one file", variant: "destructive" })
      return
    }

    if (!pdfName.trim()) {
      toast({ title: "Missing name", description: "Please enter a PDF name", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const pdfDoc = await PDFDocument.create()

      // Process each image
      for (const file of files) {
        const dataUrl = await imageToDataUrl(file)
        const image = await embedImageInPdf(pdfDoc, dataUrl, file.type)

        // Create page with image dimensions
        const page = pdfDoc.addPage([image.width, image.height])

        // Draw image on page
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        })
      }

      const pdfBytes = await pdfDoc.save()

      // Upload to Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const blob = new Blob([pdfBytes], { type: "application/pdf" })
      const pdfFile = new File([blob], `${pdfName}.pdf`, { type: "application/pdf" })

      const filePath = `${user.id}/${Date.now()}-${pdfName}.pdf`
      const { error: uploadError } = await supabase.storage.from("pdfs").upload(filePath, pdfFile)

      if (uploadError) throw uploadError

      const { error: dbError } = await supabase.from("pdfs").insert({
        user_id: user.id,
        filename: `${pdfName}.pdf`,
        file_path: filePath,
      })

      if (dbError) throw dbError

      toast({ title: "Success", description: "PDF created successfully" })
      setIsOpen(false)
      setFiles([])
      setPdfName("")
      router.refresh()
      onCreateSuccess?.()
    } catch (error) {
      console.error("Create PDF error:", error)
      toast({ title: "Error", description: "Failed to create PDF", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FilePlus2 className="h-4 w-4 mr-2" />
          Create PDF from Files
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create PDF from Images</DialogTitle>
          <DialogDescription>
            Upload images to create a PDF document. Images will be added in the order they appear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* PDF Name */}
          <div>
            <Label htmlFor="pdf-name">PDF Name</Label>
            <Input
              id="pdf-name"
              type="text"
              placeholder="My Document"
              value={pdfName}
              onChange={(e) => setPdfName(e.target.value)}
              disabled={isProcessing}
            />
          </div>

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
              isProcessing && "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <Upload
                className={cn(
                  "h-12 w-12 transition-colors",
                  isDragActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div>
                <p className="text-sm font-medium">
                  {isDragActive ? "Drop files here" : "Drag & drop images here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: JPG, PNG, GIF, WEBP (Max 20MB each)
                </p>
              </div>
              <Input
                type="file"
                accept={allAcceptedTypes.join(",")}
                onChange={handleFileChange}
                disabled={isProcessing}
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({files.length})</Label>
              <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isProcessing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setFiles([])
                setPdfName("")
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={createPdfFromImages} disabled={isProcessing || files.length === 0}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isProcessing ? "Creating..." : "Create PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
