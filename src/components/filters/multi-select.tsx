"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

/**
 * Searchable multi-select filter. Page-agnostic: reads/writes a single URL
 * param as a comma-separated list, preserving every other param. Used for the
 * profile and status filters.
 */
export function MultiSelectFilter({
  param,
  label,
  options,
}: {
  param: string
  label: string
  options: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = (searchParams.get(param) ?? "").split(",").filter(Boolean)
  const selectedSet = new Set(selected)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))

  function commit(next: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.length) params.set(param, next.join(","))
    else params.delete(param)
    params.delete("page")
    params.delete("leadId")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function toggle(value: string) {
    commit(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${selected.length} ${label.toLowerCase()}`

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              selected.length > 0 && "border-amber-300 bg-amber-50 text-amber-900",
            )}
          />
        }
      >
        {triggerLabel}
        <ChevronDown className="size-3.5 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="flex items-center gap-2 border-b border-stone-100 px-2.5">
          <Search className="size-3.5 shrink-0 text-stone-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-9 w-full bg-transparent text-xs text-stone-800 outline-none placeholder:text-stone-400"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs text-stone-400">No matches</p>
          ) : (
            filtered.map((o) => {
              const isSel = selectedSet.has(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-stone-100"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition",
                      isSel ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300",
                    )}
                  >
                    {isSel && <Check className="size-3" />}
                  </span>
                  <span className="truncate text-stone-700">{o.label}</span>
                </button>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-stone-100 p-1">
            <button
              type="button"
              onClick={() => commit([])}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
            >
              Clear {selected.length} selected
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
