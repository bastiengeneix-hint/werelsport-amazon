import { createClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const errorResult = { data: null, error: { message: "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." } }

function createChainProxy(): unknown {
  const handler: ProxyHandler<object> = {
    get(_, prop) {
      // Terminal methods that should return results
      if (prop === "then") return undefined // not a thenable itself
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(errorResult)
      }
      // All chainable methods return the proxy; await resolves to errorResult
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return (..._args: unknown[]) => {
        const chainable = new Proxy({}, handler)
        // Make it awaitable
        Object.defineProperty(chainable, "then", {
          value: (resolve: (v: unknown) => void) => resolve(errorResult),
          enumerable: false,
        })
        return chainable
      }
    },
  }
  return new Proxy({}, handler)
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
