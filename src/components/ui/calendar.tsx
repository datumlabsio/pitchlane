"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"

import { cn } from "@/lib/utils"

export type { DateRange } from "react-day-picker"

function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    // Theme react-day-picker to the app's amber accent — CSS vars cascade into .rdp-root.
    <div
      style={
        {
          "--rdp-accent-color": "#d97706",
          "--rdp-accent-background-color": "#fef3c7",
          "--rdp-font-family": "inherit",
          "--rdp-day-width": "2.1rem",
          "--rdp-day-height": "2.1rem",
        } as React.CSSProperties
      }
    >
      <DayPicker
        className={cn("text-sm text-stone-800 [--rdp-outside-opacity:0.4]", className)}
        {...props}
      />
    </div>
  )
}

export { Calendar }
