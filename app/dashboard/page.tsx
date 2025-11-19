import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PDFUploadDialog } from "@/components/pdf-upload-dialog"
import { PDFFolderView } from "@/components/pdf-folder-view"
import { CreateFolderDialog } from "@/components/create-folder-dialog"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

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

  const { data: folders } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My PDFs</h1>
            <p className="text-muted-foreground mt-1">Manage and annotate your PDF documents</p>
          </div>
          <div className="flex gap-3">
            <PDFUploadDialog />
            <CreateFolderDialog />
            <ThemeToggle />
            <form action="/api/auth/logout" method="post">
              <Button variant="outline" type="submit">
                Logout
              </Button>
            </form>
          </div>
        </div>

        <PDFFolderView pdfs={pdfs || []} folders={folders || []} />
      </div>
    </main>
  )
}
