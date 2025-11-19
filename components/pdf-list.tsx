"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

interface PDF {
  id: string
  filename: string
  file_path: string
  created_at: string
}

interface PDFListProps {
  pdfs: PDF[]
}

export function PDFList({ pdfs }: PDFListProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleDelete = async (pdfId: string, filePath: string) => {
    if (!confirm("Are you sure you want to delete this PDF?")) return

    setIsDeleting(pdfId)
    try {
      // Delete from storage
      await supabase.storage.from("pdfs").remove([filePath])

      // Delete from database
      await supabase.from("pdfs").delete().eq("id", pdfId)

      router.refresh()
    } catch (error) {
      console.error("[v0] Error deleting PDF:", error)
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pdfs.map((pdf) => (
        <Card key={pdf.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="truncate text-base">{pdf.filename}</CardTitle>
            <CardDescription className="text-xs">{formatDate(pdf.created_at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Link href={`/viewer/${pdf.id}`} className="flex-1">
                <Button variant="default" className="w-full">
                  View
                </Button>
              </Link>
              <Button
                variant="destructive"
                onClick={() => handleDelete(pdf.id, pdf.file_path)}
                disabled={isDeleting === pdf.id}
              >
                {isDeleting === pdf.id ? "..." : "Delete"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
