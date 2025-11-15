import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PDFViewer } from "@/components/pdf-viewer"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <PDFViewer pdfId={pdf.id} fileName={pdf.filename} filePath={pdf.file_path} />
        </div>
      </div>
    </main>
  )
}
