"use client"

import { useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Annotation {
  id: string
  page_number: number
  annotation_type: "highlight" | "note"
  content?: string
  position?: { x: number; y: number }
  created_at: string
}

interface PDFViewerProps {
  pdfId: string
  fileName: string
  filePath: string
}

export function PDFViewer({ pdfId, fileName, filePath }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const supabaseClient = createClient()

  // Initialize PDF.js worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  }, [])

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const {
          data: { publicUrl },
        } = supabaseClient.storage.from("pdfs").getPublicUrl(filePath)

        const pdf = await pdfjsLib.getDocument(publicUrl).promise
        setPdf(pdf)
        setTotalPages(pdf.numPages)
        setIsLoading(false)
      } catch (error) {
        console.error("[v0] Error loading PDF:", error)
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [filePath, supabaseClient])

  // Load annotations
  useEffect(() => {
    const loadAnnotations = async () => {
      const { data, error } = await supabaseClient
        .from("annotations")
        .select("*")
        .eq("pdf_id", pdfId)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setAnnotations(data as Annotation[])
      }
    }

    loadAnnotations()
  }, [pdfId, supabaseClient])

  // Render page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return

    const renderPage = async () => {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current!
      const context = canvas.getContext("2d")

      canvas.width = viewport.width
      canvas.height = viewport.height

      if (context) {
        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise

        // Draw annotations
        const pageAnnotations = annotations.filter((a) => a.page_number === currentPage)

        pageAnnotations.forEach((annotation) => {
          if (annotation.annotation_type === "highlight" && annotation.position) {
            context.fillStyle = "rgba(255, 255, 0, 0.3)"
            context.fillRect(annotation.position.x, annotation.position.y, 100, 20)
          }
        })
      }
    }

    renderPage()
  }, [pdf, currentPage, annotations])

  const handleAddNote = async () => {
    if (!noteContent.trim()) return

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()
      if (!user) return

      const { error } = await supabaseClient.from("annotations").insert({
        pdf_id: pdfId,
        user_id: user.id,
        page_number: currentPage,
        annotation_type: "note",
        content: noteContent,
      })

      if (!error) {
        setNoteContent("")
        setIsAddingNote(false)
        // Refresh annotations
        const { data } = await supabaseClient.from("annotations").select("*").eq("pdf_id", pdfId)
        if (data) setAnnotations(data as Annotation[])
      }
    } catch (error) {
      console.error("[v0] Error adding note:", error)
    }
  }

  const handleDeleteAnnotation = async (annotationId: string) => {
    try {
      await supabaseClient.from("annotations").delete().eq("id", annotationId)

      setAnnotations(annotations.filter((a) => a.id !== annotationId))
    } catch (error) {
      console.error("[v0] Error deleting annotation:", error)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading PDF...</div>
  }

  const pageNotes = annotations.filter((a) => a.page_number === currentPage && a.annotation_type === "note")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 justify-between">
        <h2 className="text-lg font-semibold">{fileName}</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto bg-gray-50">
        <canvas ref={canvasRef} className="w-full" style={{ maxHeight: "600px", margin: "0 auto", display: "block" }} />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setIsAddingNote(true)} variant="outline">
          Add Note
        </Button>
      </div>

      <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note (Page {currentPage})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAddingNote(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote}>Save Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {pageNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Notes on this page:</h3>
          {pageNotes.map((note) => (
            <div key={note.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
              <p className="text-sm">{note.content}</p>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteAnnotation(note.id)} className="text-xs">
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
