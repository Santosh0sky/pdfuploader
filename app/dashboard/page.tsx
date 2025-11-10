import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PDFUploadDialog } from "@/components/pdf-upload-dialog"
import { PDFList } from "@/components/pdf-list"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: pdfs } = await supabase
    .from("pdfs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My PDFs</h1>
            <p className="text-slate-600 mt-1">Manage and annotate your PDF documents</p>
          </div>
          <div className="flex gap-3">
            <PDFUploadDialog />
            <form action="/api/auth/logout" method="post">
              <Button variant="outline" type="submit">
                Logout
              </Button>
            </form>
          </div>
        </div>

        {pdfs && pdfs.length > 0 ? (
          <PDFList pdfs={pdfs} />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-600 mb-4">No PDFs uploaded yet. Start by uploading your first PDF.</p>
            <PDFUploadDialog />
          </div>
        )}
      </div>
    </main>
  )
}
