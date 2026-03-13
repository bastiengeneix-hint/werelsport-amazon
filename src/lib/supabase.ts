import { createClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const errorResult = { data: null, error: { message: "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." } }

// Creates a thenable chain proxy: any method call returns a new thenable proxy,
// and awaiting it resolves to errorResult.
function createThenableProxy(): unknown {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(errorResult)
      }
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(errorResult)
      }
      return () => createThenableProxy()
    },
  })
}

// Initial chain proxy from .from() — NOT thenable itself (you don't await .from()),
// but any method called on it (.select(), .insert(), etc.) returns a thenable proxy.
function createChainProxy(): unknown {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === "then") return undefined
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(errorResult)
      }
      return () => createThenableProxy()
    },
  })
}

function createSafeClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    return new Proxy({} as SupabaseClient, {
      get(_, prop) {
        if (prop === "from") {
          return () => createChainProxy()
        }
        return () => Promise.resolve(errorResult)
      },
    })
  }
  return createClient(url, key)
}

export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = supabaseServiceKey
  ? createSafeClient(supabaseUrl, supabaseServiceKey)
  : supabase
