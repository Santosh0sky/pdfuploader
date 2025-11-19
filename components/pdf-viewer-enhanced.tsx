"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Columns2,
  FileText,
  Minimize2,
  AlignVerticalJustifyCenter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PDFEditor } from "@/components/pdf-editor"
import { useRouter } from "next/navigation"

type ViewMode = "single" | "double"
type FitMode = "width" | "height" | "page" | "auto"

interface Annotation {
  id: string
  page_number: number
  annotation_type: "highlight" | "note"
  content?: string
  position?: { x: number; y: number }
  created_at: string
}

interface PDFViewerEnhancedProps {
  pdfId: string
  fileName: string
  filePath: string
}

export function PDFViewerEnhanced({ pdfId, fileName, filePath }: PDFViewerEnhancedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef2 = useRef<HTMLCanvasElement>(null) // For two-page view
  const containerRef = useRef<HTMLDivElement>(null)

  const [pdf, setPdf] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Enhanced controls
  const [zoom, setZoom] = useState(1.0)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [viewMode, setViewMode] = useState<ViewMode>("single")
  const [fitMode, setFitMode] = useState<FitMode>("auto")
  const [pageInput, setPageInput] = useState("1")

  const supabaseClient = createClient()
  const router = useRouter()

  // Initialize PDF.js worker
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
        const { data, error } = await supabaseClient.storage
          .from("pdfs")
          .createSignedUrl(filePath, 3600)

        if (error) throw error
        if (!data?.signedUrl) throw new Error("Failed to get signed URL")

        // Fetch PDF with proper headers to avoid QUIC protocol issues
        const response = await fetch(data.signedUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/pdf',
          },
          cache: 'no-cache',
        })

        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`)

        const arrayBuffer = await response.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        setPdf(pdf)
        setTotalPages(pdf.numPages)
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading PDF:", error)
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

  // Calculate scale based on fit mode
  const calculateScale = useCallback((page: any, containerWidth: number, containerHeight: number): number => {
    const viewport = page.getViewport({ scale: 1, rotation })

    switch (fitMode) {
      case "width":
        return (containerWidth - 40) / viewport.width
      case "height":
        return (containerHeight - 40) / viewport.height
      case "page":
        const widthScale = (containerWidth - 40) / viewport.width
        const heightScale = (containerHeight - 40) / viewport.height
        return Math.min(widthScale, heightScale)
      case "auto":
      default:
        return Math.min((containerWidth - 40) / viewport.width, 2.5)
    }
  }, [fitMode, rotation])

  // Render page on canvas
  const renderPageOnCanvas = useCallback(async (
    page: any,
    canvas: HTMLCanvasElement,
    pageNumber: number
  ) => {
    const context = canvas.getContext("2d")
    if (!context) return

    const containerWidth = containerRef.current?.clientWidth || 800
    const containerHeight = containerRef.current?.clientHeight || 600
    const devicePixelRatio = window.devicePixelRatio || 1

    const baseScale = calculateScale(page, containerWidth, containerHeight)
    const renderScale = baseScale * zoom * devicePixelRatio
    const scaledViewport = page.getViewport({ scale: renderScale, rotation })

    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    const displayWidth = scaledViewport.width / devicePixelRatio
    const displayHeight = scaledViewport.height / devicePixelRatio
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"

    const renderTask = page.render({
      canvasContext: context,
      viewport: scaledViewport,
    })

    await renderTask.promise

    // Draw annotations
    const pageAnnotations = annotations.filter((a) => a.page_number === pageNumber)
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
  }, [calculateScale, zoom, rotation, annotations])

  // Render pages
  useEffect(() => {
    if (!pdf || !canvasRef.current) return

    let cancelled = false

    const renderPages = async () => {
      try {
        const page1 = await pdf.getPage(currentPage)
        await renderPageOnCanvas(page1, canvasRef.current!, currentPage)

        // Render second page if in double page view
        if (viewMode === "double" && currentPage < totalPages && canvasRef2.current) {
          const page2 = await pdf.getPage(currentPage + 1)
          if (!cancelled) {
            await renderPageOnCanvas(page2, canvasRef2.current, currentPage + 1)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error rendering pages:", error)
        }
      }
    }

    renderPages()

    return () => {
      cancelled = true
    }
  }, [pdf, currentPage, viewMode, totalPages, renderPageOnCanvas])

  // Handlers
  const handleAddNote = async () => {
    if (!noteContent.trim()) return

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
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
        const { data } = await supabaseClient.from("annotations").select("*").eq("pdf_id", pdfId)
        if (data) setAnnotations(data as Annotation[])
      }
    } catch (error) {
      console.error("Error adding note:", error)
    }
  }

  const handleDeleteAnnotation = async (annotationId: string) => {
    try {
      await supabaseClient.from("annotations").delete().eq("id", annotationId)
      setAnnotations(annotations.filter((a) => a.id !== annotationId))
    } catch (error) {
      console.error("Error deleting annotation:", error)
    }
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 5.0))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25))
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  const handleZoomLevel = (level: string) => {
    if (level === "custom") return
    setZoom(parseFloat(level))
  }

  const handlePrevPage = () => {
    if (viewMode === "double") {
      setCurrentPage(Math.max(1, currentPage - 2))
    } else {
      setCurrentPage(Math.max(1, currentPage - 1))
    }
  }

  const handleNextPage = () => {
    if (viewMode === "double") {
      setCurrentPage(Math.min(totalPages - 1, currentPage + 2))
    } else {
      setCurrentPage(Math.min(totalPages, currentPage + 1))
    }
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

  const pageNotes = annotations.filter(
    (a) => a.page_number === currentPage && a.annotation_type === "note"
  )

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 justify-between flex-wrap border-b pb-4">
        <h2 className="text-lg font-semibold truncate">{fileName}</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Page Navigation */}
          <Button
            onClick={handlePrevPage}
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
            <span className="text-sm">
              of {totalPages}
            </span>
          </form>
          <Button
            onClick={handleNextPage}
            disabled={
              viewMode === "double"
                ? currentPage >= totalPages - 1
                : currentPage === totalPages
            }
            variant="outline"
            size="sm"
          >
            Next
          </Button>

          {/* View Mode */}
          <div className="flex items-center gap-1 ml-4 border-l pl-4">
            <Button
              onClick={() => setViewMode("single")}
              variant={viewMode === "single" ? "default" : "outline"}
              size="sm"
              title="Single page view"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setViewMode("double")}
              variant={viewMode === "double" ? "default" : "outline"}
              size="sm"
              title="Two page view"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-4 border-l pl-4">
            <Button onClick={handleZoomOut} disabled={zoom <= 0.25} variant="outline" size="sm">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={zoom.toString()} onValueChange={handleZoomLevel}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue>{Math.round(zoom * 100)}%</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">50%</SelectItem>
                <SelectItem value="0.75">75%</SelectItem>
                <SelectItem value="1">100%</SelectItem>
                <SelectItem value="1.25">125%</SelectItem>
                <SelectItem value="1.5">150%</SelectItem>
                <SelectItem value="2">200%</SelectItem>
                <SelectItem value="3">300%</SelectItem>
                <SelectItem value="custom">{Math.round(zoom * 100)}%</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleZoomIn} disabled={zoom >= 5.0} variant="outline" size="sm">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Fit Mode */}
          <div className="flex items-center gap-1 ml-4 border-l pl-4">
            <Button
              onClick={() => setFitMode("width")}
              variant={fitMode === "width" ? "default" : "outline"}
              size="sm"
              title="Fit to width"
            >
              <Maximize2 className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              onClick={() => setFitMode("height")}
              variant={fitMode === "height" ? "default" : "outline"}
              size="sm"
              title="Fit to height"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setFitMode("page")}
              variant={fitMode === "page" ? "default" : "outline"}
              size="sm"
              title="Fit to page"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setFitMode("auto")}
              variant={fitMode === "auto" ? "default" : "outline"}
              size="sm"
              title="Fit visible content"
            >
              <AlignVerticalJustifyCenter className="h-4 w-4" />
            </Button>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-1 ml-4 border-l pl-4">
            <Button onClick={handleRotate} variant="outline" size="sm" title="Rotate page">
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div
        ref={containerRef}
        className="border rounded-lg overflow-auto bg-muted/30 flex justify-center p-4 flex-1"
      >
        <div className={cn("flex gap-4", viewMode === "double" ? "flex-row" : "flex-col")}>
          <canvas
            ref={canvasRef}
            className="shadow-lg"
            style={{ maxWidth: "100%", height: "auto", display: "block" }}
          />
          {viewMode === "double" && currentPage < totalPages && (
            <canvas
              ref={canvasRef2}
              className="shadow-lg"
              style={{ maxWidth: "100%", height: "auto", display: "block" }}
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 items-center flex-wrap">
        <Button onClick={() => setIsAddingNote(true)} variant="outline">
          Add Note
        </Button>
        <div className="border-l pl-4">
          <PDFEditor
            pdfId={pdfId}
            fileName={fileName}
            filePath={filePath}
            onEditComplete={() => router.refresh()}
          />
        </div>
      </div>

      {/* Add Note Dialog */}
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

      {/* Display Notes */}
      {pageNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Notes on this page:</h3>
          {pageNotes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-2"
            >
              <p className="text-sm">{note.content}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteAnnotation(note.id)}
                className="text-xs"
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
