import {
  AlertTriangle,
  CircleSlash,
  Droplet,
  Droplets,
  type LucideIcon,
  PrinterIcon,
  ShieldCheck,
  Clock,
} from "lucide-react"
import { cn } from "#/lib/utils"

export interface Kpi {
  key: string
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone: "brand" | "ok" | "idle" | "warn" | "critical" | "neutral"
}

const TONES: Record<Kpi["tone"], { ring: string; chip: string; value: string }> =
  {
    brand: {
      ring: "ring-brand/15",
      chip: "bg-brand/10 text-brand ring-brand/20",
      value: "text-foreground",
    },
    ok: {
      ring: "ring-ok/15",
      chip: "bg-ok/10 text-ok ring-ok/20",
      value: "text-foreground",
    },
    idle: {
      ring: "ring-idle/15",
      chip: "bg-idle/10 text-idle ring-idle/20",
      value: "text-foreground",
    },
    warn: {
      ring: "ring-warn/20",
      chip: "bg-warn/12 text-warn ring-warn/25",
      value: "text-warn",
    },
    critical: {
      ring: "ring-critical/20",
      chip: "bg-critical/10 text-critical ring-critical/25",
      value: "text-critical",
    },
    neutral: {
      ring: "ring-border",
      chip: "bg-muted text-muted-foreground ring-border",
      value: "text-foreground",
    },
  }

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const tone = TONES[kpi.tone]
  const Icon = kpi.icon

  return (
    <article
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-inset",
        tone.ring,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {kpi.label}
        </p>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            tone.chip,
          )}
          aria-hidden="true"
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <div>
        <p
          className={cn(
            "text-2xl leading-none font-extrabold tabular-nums",
            tone.value,
          )}
        >
          {kpi.value}
        </p>
        <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">
          {kpi.hint}
        </p>
      </div>
    </article>
  )
}

export const KPI_ICONS = {
  PrinterIcon,
  ShieldCheck,
  CircleSlash,
  AlertTriangle,
  Droplet,
  Droplets,
  Clock,
}
