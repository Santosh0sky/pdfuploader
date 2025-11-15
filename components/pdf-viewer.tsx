"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ZoomIn, ZoomOut } from "lucide-react"

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
  const [pdf, setPdf] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [zoom, setZoom] = useState(1.0)
  const [pageInput, setPageInput] = useState("1")
  const supabaseClient = createClient()

  // Initialize PDF.js worker (only on client)
  useEffect(() => {
    import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    })
  }, [])

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist")

        // Use createSignedUrl for private buckets with RLS
        const { data, error } = await supabaseClient.storage
          .from("pdfs")
          .createSignedUrl(filePath, 3600) // URL valid for 1 hour

        if (error) throw error
        if (!data?.signedUrl) throw new Error("Failed to get signed URL")

        const pdf = await pdfjsLib.getDocument(data.signedUrl).promise
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

    let renderTask: any = null
    let cancelled = false

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage)
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        const context = canvas.getContext("2d")
        if (!context) return

        // Get device pixel ratio for high-DPI displays (Retina, etc.)
        const devicePixelRatio = window.devicePixelRatio || 1

        // Calculate scale based on container width while maintaining aspect ratio
        const containerWidth = canvas.parentElement?.clientWidth || 800
        const viewport = page.getViewport({ scale: 1 })
        const baseScale = Math.min((containerWidth - 40) / viewport.width, 2.5)

        // Apply user zoom on top of base scale
        // Multiply by device pixel ratio for crisp rendering on high-DPI screens
        const renderScale = baseScale * zoom * devicePixelRatio
        const scaledViewport = page.getViewport({ scale: renderScale })

        // Set canvas buffer size to rendered size (high resolution)
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        // Set canvas display size (CSS) to actual desired size
        const displayWidth = scaledViewport.width / devicePixelRatio
        const displayHeight = scaledViewport.height / devicePixelRatio
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`

        // Clear canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height)

        // Enable image smoothing for better quality
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = "high"

        // Start render task
        renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport,
        })

        await renderTask.promise

        if (cancelled) return

        // Draw annotations with proper scaling
        const pageAnnotations = annotations.filter((a) => a.page_number === currentPage)

        pageAnnotations.forEach((annotation) => {
          if (annotation.annotation_type === "highlight" && annotation.position) {
            context.fillStyle = "rgba(255, 255, 0, 0.3)"
            context.fillRect(
              annotation.position.x * renderScale,
              annotation.position.y * renderScale,
              100 * renderScale,
              20 * renderScale
            )
          }
        })
      } catch (error) {
        if (!cancelled) {
          console.error("[v0] Error rendering page:", error)
        }
      }
    }

    renderPage()

    // Cleanup: cancel ongoing render when component unmounts or dependencies change
    return () => {
      cancelled = true
      if (renderTask) {
        renderTask.cancel()
      }
    }
  }, [pdf, currentPage, annotations, zoom])

  const handleAddNote = async () => {
    if (!noteContent.trim()) return

    try {
      // Authentication disabled - use a default user ID
      // const {
      //   data: { user },
      // } = await supabaseClient.auth.getUser()
      // if (!user) return

      const defaultUserId = "00000000-0000-0000-0000-000000000000"

      const { error } = await supabaseClient.from("annotations").insert({
        pdf_id: pdfId,
        user_id: defaultUserId,
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

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3.0))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pageNum = parseInt(pageInput, 10)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum)
    } else {
      setPageInput(currentPage.toString())
    }
  }

  useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

  if (isLoading) {
    return <div className="text-center py-8">Loading PDF...</div>
  }

  const pageNotes = annotations.filter((a) => a.page_number === currentPage && a.annotation_type === "note")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 justify-between flex-wrap">
        <h2 className="text-lg font-semibold">{fileName}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page Navigation */}
          <Button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <span className="text-sm">Page</span>
            <Input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              className="w-14 h-8 text-center text-sm"
            />
            <span className="text-sm">of {totalPages}</span>
          </form>
          <Button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
            size="sm"
          >
            Next
          </Button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-4 border-l pl-4">
            <Button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              variant="outline"
              size="sm"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              onClick={handleZoomIn}
              disabled={zoom >= 3.0}
              variant="outline"
              size="sm"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto bg-gray-50 flex justify-center p-4">
        <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto", display: "block" }} />
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
