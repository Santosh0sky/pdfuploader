import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PDFViewerEnhanced } from "@/components/pdf-viewer-enhanced"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: pdf, error } = await supabase
    .from("pdfs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !pdf) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 h-screen flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
          <ThemeToggle />
        </div>
        <div className="bg-card rounded-lg border p-6 flex-1 overflow-hidden">
          <PDFViewerEnhanced pdfId={pdf.id} fileName={pdf.filename} filePath={pdf.file_path} />
        </div>
      </div>
    </main>
  )
}
