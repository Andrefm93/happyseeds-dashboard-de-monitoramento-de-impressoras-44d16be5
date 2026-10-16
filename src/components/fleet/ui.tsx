import type { ReactNode } from "react"

import { cn } from "#/lib/utils"
import type { FleetPrinter, MonitorStatus, TonerBand } from "#/lib/fleet"

/* ---------------------------------------------------------------- */
/* Tons e estilos por estado                                        */
/* ---------------------------------------------------------------- */

export const STATUS_STYLE: Record<
  MonitorStatus,
  { dot: string; chip: string; label: string }
> = {
  Monitorada: {
    dot: "bg-ok",
    chip: "bg-ok/10 text-ok ring-ok/25",
    label: "Monitorada",
  },
  "Necessita Verificação": {
    dot: "bg-warn",
    chip: "bg-warn/12 text-warn ring-warn/30",
    label: "Necessita Verificação",
  },
  "Fora de Monitoramento": {
    dot: "bg-idle",
    chip: "bg-idle/12 text-idle ring-idle/25",
    label: "Fora de Monitoramento",
  },
}

export const BAND_STYLE: Record<
  TonerBand,
  { text: string; bar: string; chip: string }
> = {
  zerado: {
    text: "text-critical",
    bar: "bg-critical",
    chip: "bg-critical/10 text-critical ring-critical/30",
  },
  critico: {
    text: "text-warn",
    bar: "bg-warn",
    chip: "bg-warn/12 text-warn ring-warn/30",
  },
  atencao: {
    text: "text-brand",
    bar: "bg-brand",
    chip: "bg-brand/10 text-brand ring-brand/25",
  },
  saudavel: {
    text: "text-ok",
    bar: "bg-ok",
    chip: "bg-ok/10 text-ok ring-ok/25",
  },
  "sem-leitura": {
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground ring-border",
  },
}

/**
 * Linha da tabela colorida por criticidade: vermelha em 0%, laranja entre
 * 1% e 20% e verde acima de 20%. Sem leitura fica neutra.
 */
export function rowTone(printer: FleetPrinter): string {
  if (printer.toner === null) return "bg-transparent"
  if (printer.toner <= 0) return "bg-critical/8 hover:bg-critical/12"
  if (printer.toner <= 20) return "bg-warn/10 hover:bg-warn/16"
  return "bg-ok/6 hover:bg-ok/10"
}

/* ---------------------------------------------------------------- */
/* Primitivas                                                       */
/* ---------------------------------------------------------------- */

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

export function StatusChip({ status }: { status: MonitorStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset",
        style.chip,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}

export function TonerCell({ printer }: { printer: FleetPrinter }) {
  if (printer.toner === null) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        sem leitura
      </span>
    )
  }

  const band: TonerBand =
    printer.toner <= 0
      ? "zerado"
      : printer.toner <= 20
        ? "critico"
        : printer.toner <= 40
          ? "atencao"
          : "saudavel"
  const style = BAND_STYLE[band]

  return (
    <div className="flex min-w-[104px] items-center gap-2">
      <span
        className={cn(
          "w-11 shrink-0 text-right text-sm font-bold tabular-nums",
          style.text,
        )}
      >
        {printer.toner}%
      </span>
      <span className="h-1.5 w-full min-w-10 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", style.bar)}
          style={{ width: `${Math.max(printer.toner, 2)}%` }}
        />
      </span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
