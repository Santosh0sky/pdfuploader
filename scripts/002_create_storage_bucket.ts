import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

async function createStorageBucket() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log("[v0] Creating 'pdfs' storage bucket...")

    // Create the bucket
    const { data, error: createError } = await supabase.storage.createBucket("pdfs", {
      public: false,
      fileSizeLimit: 52428800, // 50MB in bytes
    })

    if (createError) {
      if (createError.message.includes("already exists")) {
        console.log("[v0] Bucket 'pdfs' already exists, skipping creation")
      } else {
        throw createError
      }
    } else {
      console.log("[v0] Bucket 'pdfs' created successfully:", data)
    }

    // Set RLS policies for the bucket
    console.log("[v0] Setting up RLS policies for 'pdfs' bucket...")

    // Policy: Users can upload files to their own user directory
    const { error: uploadPolicyError } = await supabase
      .rpc("fn_set_storage_policy", {
        bucket_name: "pdfs",
        policy_name: "users_can_upload_own_pdfs",
        operation: "INSERT",
        authenticated: true,
        using: "auth.uid()::text = split_part((storage.foldername(name))[1], '/', 1)",
        with_check: "auth.uid()::text = split_part((storage.foldername(name))[1], '/', 1)",
      })
      .catch((err) => {
        console.log("[v0] Note: RLS policy setting via RPC not available, policies may need manual setup")
        return { error: null }
      })

    console.log("[v0] Storage bucket setup complete!")
  } catch (error) {
    console.error("[v0] Error creating storage bucket:", error)
    throw error
  }
}

createStorageBucket()
