import { createClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createSafeClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    // Return a proxy that throws helpful errors instead of crashing
    return new Proxy({} as SupabaseClient, {
      get(_, prop) {
        if (prop === "from") {
          return () =>
            new Proxy(
              {},
              {
                get() {
                  return () =>
                    Promise.resolve({
                      data: null,
                      error: { message: "Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
                    })
                },
              }
            )
        }
        return () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } })
      },
    })
  }
  return createClient(url, key)
}

export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = supabaseServiceKey
  ? createSafeClient(supabaseUrl, supabaseServiceKey)
  : supabase
