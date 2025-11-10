import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">PDF Upload & Viewer</h1>
        <p className="text-xl text-slate-600 mb-8">
          Securely upload, view, and annotate your PDF documents. Add notes and highlights to keep track of important
          information.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/login">
            <Button size="lg">Login</Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button size="lg" variant="outline">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
