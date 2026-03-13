"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold">Une erreur est survenue</h2>
        <p className="text-sm text-slate-400">
          {error.message || "Erreur inattendue. Vérifiez la configuration."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  )
}
