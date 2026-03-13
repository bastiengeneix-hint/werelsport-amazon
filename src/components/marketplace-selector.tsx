"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Globe } from "lucide-react"

interface MarketplaceOption {
  marketplace_id: string
  country_code: string
  name: string
  is_active: boolean
}

interface ActiveSetting {
  activeMarketplaceId: string
}

const FLAGS: Record<string, string> = {
  FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", IT: "🇮🇹", UK: "🇬🇧",
  NL: "🇳🇱", SE: "🇸🇪", PL: "🇵🇱", BE: "🇧🇪", EG: "🇪🇬",
  TR: "🇹🇷", SA: "🇸🇦", AE: "🇦🇪", IN: "🇮🇳",
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", BR: "🇧🇷",
  JP: "🇯🇵", AU: "🇦🇺", SG: "🇸🇬",
}

export function MarketplaceSelector() {
  const [marketplaces, setMarketplaces] = useState<MarketplaceOption[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [mpRes, settingsRes] = await Promise.all([
          fetch("/api/amazon/marketplaces"),
          fetch("/api/settings/marketplace"),
        ])
        if (mpRes.ok) {
          const data = await mpRes.json()
          setMarketplaces(data.marketplaces || [])
        }
        if (settingsRes.ok) {
          const data: ActiveSetting = await settingsRes.json()
          setActiveId(data.activeMarketplaceId || "")
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSelect(mpId: string) {
    setActiveId(mpId)
    setOpen(false)
    try {
      await fetch("/api/settings/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeMarketplaceId: mpId }),
      })
      // Reload the page to refresh data with new marketplace
      window.location.reload()
    } catch {
      // silently fail
    }
  }

  const activeMp = marketplaces.find((m) => m.marketplace_id === activeId)

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
        <Globe className="h-4 w-4" />
        <span>Chargement…</span>
      </div>
    )
  }

  if (marketplaces.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Globe className="h-4 w-4" />
        <span>Aucune marketplace</span>
      </div>
    )
  }

  return (
    <div className="relative px-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        <span className="text-base">{activeMp ? FLAGS[activeMp.country_code] || "🌐" : "🌐"}</span>
        <span className="flex-1 text-left truncate">
          {activeMp?.name || "Sélectionner"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border bg-popover shadow-md max-h-64 overflow-y-auto">
            {marketplaces.filter((m) => m.is_active).map((mp) => (
              <button
                key={mp.marketplace_id}
                onClick={() => handleSelect(mp.marketplace_id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors",
                  mp.marketplace_id === activeId && "bg-accent font-medium"
                )}
              >
                <span className="text-base">{FLAGS[mp.country_code] || "🌐"}</span>
                <span className="truncate">{mp.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
