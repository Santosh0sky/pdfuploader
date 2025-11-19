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
import { useToast } from "@/hooks/use-toast"
import { Loader2, Scissors, Merge, Trash2, FileDown } from "lucide-react"
import { PDFDocument } from "pdf-lib"

interface PDFEditorProps {
  pdfId: string
  fileName: string
  filePath: string
  onEditComplete?: () => void
}

type EditAction = "split" | "extract" | "delete" | "merge" | null

export function PDFEditor({ pdfId, fileName, filePath, onEditComplete }: PDFEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [action, setAction] = useState<EditAction>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pageRange, setPageRange] = useState("")
  const [mergePdfId, setMergePdfId] = useState<string>("")
  const [availablePdfs, setAvailablePdfs] = useState<any[]>([])

  const { toast } = useToast()
  const supabase = createClient()

  const openDialog = async (editAction: EditAction) => {
    setAction(editAction)
    setIsOpen(true)

    if (editAction === "merge") {
      // Load available PDFs for merging
      const { data } = await supabase.from("pdfs").select("*").neq("id", pdfId)
      if (data) setAvailablePdfs(data)
    }
  }

  const loadPdfBytes = async (path: string): Promise<Uint8Array> => {
    const { data, error } = await supabase.storage.from("pdfs").createSignedUrl(path, 3600)

    if (error || !data?.signedUrl) {
      throw new Error("Failed to get PDF URL")
    }

    const response = await fetch(data.signedUrl)
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  const uploadPdf = async (pdfBytes: Uint8Array, newFileName: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const blob = new Blob([pdfBytes], { type: "application/pdf" })
    const file = new File([blob], newFileName, { type: "application/pdf" })

    const newFilePath = `${user.id}/${Date.now()}-${newFileName}`
    const { error: uploadError } = await supabase.storage.from("pdfs").upload(newFilePath, file)

    if (uploadError) throw uploadError

    const { error: dbError } = await supabase.from("pdfs").insert({
      user_id: user.id,
      filename: newFileName,
      file_path: newFilePath,
    })

    if (dbError) throw dbError

    return newFilePath
  }

  const handleSplitPdf = async () => {
    if (!pageRange) {
      toast({ title: "Error", description: "Please enter a page number to split at", variant: "destructive" })
      return
    }

    const splitPage = parseInt(pageRange)
    if (isNaN(splitPage) || splitPage < 1) {
      toast({ title: "Error", description: "Invalid page number", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const pdfBytes = await loadPdfBytes(filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const totalPages = pdfDoc.getPageCount()

      if (splitPage >= totalPages) {
        toast({ title: "Error", description: "Split page exceeds total pages", variant: "destructive" })
        return
      }

      // Create first part
      const pdf1 = await PDFDocument.create()
      const pages1 = await pdf1.copyPages(pdfDoc, Array.from({ length: splitPage }, (_, i) => i))
      pages1.forEach((page) => pdf1.addPage(page))

      // Create second part
      const pdf2 = await PDFDocument.create()
      const pages2 = await pdf1.copyPages(
        pdfDoc,
        Array.from({ length: totalPages - splitPage }, (_, i) => i + splitPage)
      )
      pages2.forEach((page) => pdf2.addPage(page))

      const pdf1Bytes = await pdf1.save()
      const pdf2Bytes = await pdf2.save()

      await uploadPdf(pdf1Bytes, `${fileName.replace(".pdf", "")}_part1.pdf`)
      await uploadPdf(pdf2Bytes, `${fileName.replace(".pdf", "")}_part2.pdf`)

      toast({ title: "Success", description: "PDF split successfully" })
      setIsOpen(false)
      onEditComplete?.()
    } catch (error) {
      console.error("Split error:", error)
      toast({ title: "Error", description: "Failed to split PDF", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExtractPages = async () => {
    if (!pageRange) {
      toast({ title: "Error", description: "Please enter page range (e.g., 1-3,5)", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const pdfBytes = await loadPdfBytes(filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)

      // Parse page range
      const pageNumbers: number[] = []
      const ranges = pageRange.split(",")

      for (const range of ranges) {
        if (range.includes("-")) {
          const [start, end] = range.split("-").map((n) => parseInt(n.trim()))
          for (let i = start; i <= end; i++) {
            pageNumbers.push(i - 1) // 0-indexed
          }
        } else {
          pageNumbers.push(parseInt(range.trim()) - 1)
        }
      }

      const newPdf = await PDFDocument.create()
      const copiedPages = await newPdf.copyPages(pdfDoc, pageNumbers)
      copiedPages.forEach((page) => newPdf.addPage(page))

      const newPdfBytes = await newPdf.save()
      await uploadPdf(newPdfBytes, `${fileName.replace(".pdf", "")}_extracted.pdf`)

      toast({ title: "Success", description: "Pages extracted successfully" })
      setIsOpen(false)
      onEditComplete?.()
    } catch (error) {
      console.error("Extract error:", error)
      toast({ title: "Error", description: "Failed to extract pages", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeletePages = async () => {
    if (!pageRange) {
      toast({ title: "Error", description: "Please enter pages to delete (e.g., 1-3,5)", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const pdfBytes = await loadPdfBytes(filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const totalPages = pdfDoc.getPageCount()

      // Parse pages to delete
      const pagesToDelete: number[] = []
      const ranges = pageRange.split(",")

      for (const range of ranges) {
        if (range.includes("-")) {
          const [start, end] = range.split("-").map((n) => parseInt(n.trim()))
          for (let i = start; i <= end; i++) {
            pagesToDelete.push(i - 1)
          }
        } else {
          pagesToDelete.push(parseInt(range.trim()) - 1)
        }
      }

      // Create new PDF with remaining pages
      const newPdf = await PDFDocument.create()
      const pagesToKeep = Array.from({ length: totalPages }, (_, i) => i).filter(
        (i) => !pagesToDelete.includes(i)
      )
      const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeep)
      copiedPages.forEach((page) => newPdf.addPage(page))

      const newPdfBytes = await newPdf.save()
      await uploadPdf(newPdfBytes, `${fileName.replace(".pdf", "")}_edited.pdf`)

      toast({ title: "Success", description: "Pages deleted successfully" })
      setIsOpen(false)
      onEditComplete?.()
    } catch (error) {
      console.error("Delete error:", error)
      toast({ title: "Error", description: "Failed to delete pages", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMergePdfs = async () => {
    if (!mergePdfId) {
      toast({ title: "Error", description: "Please select a PDF to merge with", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const mergePdf = availablePdfs.find((p) => p.id === mergePdfId)
      if (!mergePdf) throw new Error("PDF not found")

      const pdf1Bytes = await loadPdfBytes(filePath)
      const pdf2Bytes = await loadPdfBytes(mergePdf.file_path)

      const pdf1Doc = await PDFDocument.load(pdf1Bytes)
      const pdf2Doc = await PDFDocument.load(pdf2Bytes)

      const mergedPdf = await PDFDocument.create()

      const pages1 = await mergedPdf.copyPages(pdf1Doc, pdf1Doc.getPageIndices())
      const pages2 = await mergedPdf.copyPages(pdf2Doc, pdf2Doc.getPageIndices())

      pages1.forEach((page) => mergedPdf.addPage(page))
      pages2.forEach((page) => mergedPdf.addPage(page))

      const mergedPdfBytes = await mergedPdf.save()
      await uploadPdf(
        mergedPdfBytes,
        `${fileName.replace(".pdf", "")}_merged_${mergePdf.filename}`
      )

      toast({ title: "Success", description: "PDFs merged successfully" })
      setIsOpen(false)
      onEditComplete?.()
    } catch (error) {
      console.error("Merge error:", error)
      toast({ title: "Error", description: "Failed to merge PDFs", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAction = () => {
    switch (action) {
      case "split":
        handleSplitPdf()
        break
      case "extract":
        handleExtractPages()
        break
      case "delete":
        handleDeletePages()
        break
      case "merge":
        handleMergePdfs()
        break
    }
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => openDialog("split")} size="sm">
          <Scissors className="h-4 w-4 mr-2" />
          Split
        </Button>
        <Button variant="outline" onClick={() => openDialog("extract")} size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          Extract Pages
        </Button>
        <Button variant="outline" onClick={() => openDialog("delete")} size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Pages
        </Button>
        <Button variant="outline" onClick={() => openDialog("merge")} size="sm">
          <Merge className="h-4 w-4 mr-2" />
          Merge
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "split" && "Split PDF"}
              {action === "extract" && "Extract Pages"}
              {action === "delete" && "Delete Pages"}
              {action === "merge" && "Merge PDFs"}
            </DialogTitle>
            <DialogDescription>
              {action === "split" && "Split the PDF into two parts at the specified page"}
              {action === "extract" && "Extract specific pages into a new PDF"}
              {action === "delete" && "Remove specific pages from the PDF"}
              {action === "merge" && "Merge this PDF with another"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {action === "split" && (
              <div>
                <Label htmlFor="split-page">Split at page</Label>
                <Input
                  id="split-page"
                  type="number"
                  placeholder="e.g., 3"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  disabled={isProcessing}
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The PDF will be split into two files
                </p>
              </div>
            )}

            {(action === "extract" || action === "delete") && (
              <div>
                <Label htmlFor="pages">
                  {action === "extract" ? "Pages to extract" : "Pages to delete"}
                </Label>
                <Input
                  id="pages"
                  type="text"
                  placeholder="e.g., 1-3,5,7-9"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter page numbers or ranges separated by commas
                </p>
              </div>
            )}

            {action === "merge" && (
              <div>
                <Label htmlFor="merge-pdf">PDF to merge with</Label>
                <Select value={mergePdfId} onValueChange={setMergePdfId} disabled={isProcessing}>
                  <SelectTrigger id="merge-pdf">
                    <SelectValue placeholder="Select a PDF" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePdfs.map((pdf) => (
                      <SelectItem key={pdf.id} value={pdf.id}>
                        {pdf.filename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  The selected PDF will be appended to the current one
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button onClick={handleAction} disabled={isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isProcessing ? "Processing..." : "Apply"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
