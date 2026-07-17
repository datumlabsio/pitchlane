"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, type DateRange } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { DATE_PRESET_LABELS, formatDateFilterLabel } from "@/lib/date-window"

const DATE_PRESETS: Array<{ token: string; label: string }> = [
  { token: "this_week", label: DATE_PRESET_LABELS.this_week },
  { token: "last_week", label: DATE_PRESET_LABELS.last_week },
  { token: "7d", label: DATE_PRESET_LABELS["7d"] },
  { token: "24h", label: DATE_PRESET_LABELS["24h"] },
  { token: "this_month", label: DATE_PRESET_LABELS.this_month },
  { token: "last_month", label: DATE_PRESET_LABELS.last_month },
  { token: "any", label: DATE_PRESET_LABELS.any },
]

/**
 * Unified date filter — preset quick-picks + a custom calendar range. Drives
 * the URL params `?since` (preset) and `?from`/`?to` (custom, yyyy-MM-dd),
 * preserving every other param so it drops into any page (leads, dashboard,
 * metrics) unchanged. `defaultToken` is the preset a page treats as active when
 * no `since`/`from`/`to` param is present yet (e.g. Metrics defaults to "this week").
 */
export function DateRangeFilter({ defaultToken = "any" }: { defaultToken?: string } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const since = searchParams.get("since") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined

  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const f = from ? new Date(`${from}T00:00:00`) : undefined
    const t = to ? new Date(`${to}T00:00:00`) : undefined
    return f || t ? { from: f, to: t } : undefined
  })

  const hasCustom = Boolean(from || to)
  const effectiveToken = since ?? (hasCustom ? undefined : defaultToken)
  const active = hasCustom || Boolean(since) || effectiveToken !== "any"
  const label = formatDateFilterLabel({ since, from, to }, defaultToken)

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k)
      else params.set(k, v)
    }
    params.delete("page")
    params.delete("leadId")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function pickPreset(token: string) {
    navigate({ since: token, from: null, to: null })
    setOpen(false)
  }
  function applyRange() {
    if (!range?.from) return
    navigate({
      from: format(range.from, "yyyy-MM-dd"),
      to: range.to ? format(range.to, "yyyy-MM-dd") : null,
      since: null,
    })
    setOpen(false)
  }
  function clearRange() {
    setRange(undefined)
    navigate({ from: null, to: null })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 gap-1.5 text-xs", active && "border-amber-300 bg-amber-50 text-amber-900")}
          />
        }
      >
        <CalendarDays className="size-3.5" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          {/* Preset quick-picks — apply on click */}
          <div className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-stone-100 p-2">
            {DATE_PRESETS.map((p) => {
              const isActive = since === p.token || (!since && !hasCustom && p.token === defaultToken)
              return (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => pickPreset(p.token)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-stone-100",
                    isActive && "bg-amber-100 font-medium text-amber-900 hover:bg-amber-100",
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {/* Custom range */}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r: DateRange | undefined) => setRange(r)}
              numberOfMonths={2}
              defaultMonth={range?.from}
              autoFocus
            />
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-stone-100 px-1 pt-2">
              <button
                type="button"
                onClick={clearRange}
                disabled={!hasCustom && !range}
                className="text-xs text-stone-500 transition hover:text-stone-700 disabled:opacity-40"
              >
                Clear
              </button>
              <Button size="sm" className="h-7 text-xs" disabled={!range?.from} onClick={applyRange}>
                Apply range
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
