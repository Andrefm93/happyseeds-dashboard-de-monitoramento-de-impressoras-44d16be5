import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCheck,
  ListFilter,
  RotateCcw,
  Search,
  X,
} from "lucide-react"

import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import {
  type FleetPrinter,
  formatDateBr,
  formatDateTimeBr,
} from "#/lib/fleet"
import { DEFECT_OPTIONS } from "#/lib/fleet-seed"
import { cn } from "#/lib/utils"
import { Card, CardHeader, EmptyState, StatusChip, TonerCell, rowTone } from "./ui"

export interface FleetFilters {
  serial: string
  model: string
  ip: string
  location: string
  status: string
}

export const EMPTY_FILTERS: FleetFilters = {
  serial: "",
  model: "",
  ip: "",
  location: "",
  status: "todos",
}

export type SortMode = "criticidade" | "modelo" | "serie" | "local" | "toner"

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "criticidade", label: "Criticidade (mais crítico primeiro)" },
  { value: "toner", label: "Toner (menor primeiro)" },
  { value: "modelo", label: "Modelo (A–Z)" },
  { value: "serie", label: "Número de série (A–Z)" },
  { value: "local", label: "Localização (A–Z)" },
]

/** Status escolhido manualmente na tabela. */
export type PrinterStatusChoice = "Monitorada" | "Fora de Monitoramento"

/** Status atual convertido para a opção editável correspondente. */
export function statusChoiceOf(printer: FleetPrinter): PrinterStatusChoice {
  return printer.status === "Fora de Monitoramento"
    ? "Fora de Monitoramento"
    : "Monitorada"
}

const STATUS_OPTIONS = [
  "todos",
  "Monitorada",
  "Necessita Verificação",
  "Fora de Monitoramento",
]

function severity(printer: FleetPrinter): number {
  if (printer.toner === 0) return 0
  if (printer.toner !== null && printer.toner <= 20) return 1
  if (printer.status === "Necessita Verificação") return 2
  if (printer.status === "Fora de Monitoramento") return 3
  if (printer.toner !== null && printer.toner <= 40) return 4
  if (printer.toner === null) return 6
  return 5
}

export function sortPrinters(
  printers: FleetPrinter[],
  mode: SortMode,
): FleetPrinter[] {
  const copy = [...printers]
  if (mode === "criticidade") {
    return copy.sort((a, b) => {
      const diff = severity(a) - severity(b)
      if (diff !== 0) return diff
      return (a.toner ?? 999) - (b.toner ?? 999)
    })
  }
  if (mode === "toner") {
    return copy.sort((a, b) => (a.toner ?? 999) - (b.toner ?? 999))
  }
  if (mode === "modelo") {
    return copy.sort((a, b) => a.model.localeCompare(b.model, "pt-BR"))
  }
  if (mode === "serie") {
    return copy.sort((a, b) => a.serial.localeCompare(b.serial, "pt-BR"))
  }
  return copy.sort((a, b) => a.location.localeCompare(b.location, "pt-BR"))
}

export function matchesFilters(
  printer: FleetPrinter,
  filters: FleetFilters,
  query: string,
): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

  if (filters.status !== "todos" && printer.status !== filters.status) return false
  if (filters.serial && !normalize(printer.serial).includes(normalize(filters.serial)))
    return false
  if (filters.model && !normalize(printer.model).includes(normalize(filters.model)))
    return false
  if (filters.ip && !normalize(printer.ip).includes(normalize(filters.ip))) return false
  if (
    filters.location &&
    !normalize(printer.location).includes(normalize(filters.location))
  )
    return false

  if (query.trim() !== "") {
    const q = normalize(query.trim())
    const haystack = normalize(
      `${printer.serial} ${printer.model} ${printer.ip} ${printer.location}`,
    )
    if (!haystack.includes(q)) return false
  }

  return true
}

export function PrintersTable({
  printers,
  filters,
  onFiltersChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onDefectChange,
  onBulkDefect,
  onAutoDefects,
  onStatusChange,
  embedded = false,
}: {
  printers: FleetPrinter[]
  filters: FleetFilters
  onFiltersChange: (next: FleetFilters) => void
  query: string
  onQueryChange: (next: string) => void
  sort: SortMode
  onSortChange: (next: SortMode) => void
  onDefectChange: (id: number, defect: string, source: "manual") => void
  onBulkDefect: (ids: number[], defect: string) => void
  onAutoDefects: (ids: number[]) => void
  onStatusChange: (id: number, status: PrinterStatusChoice) => void
  /** Quando true, a tabela é exibida dentro de um cartão já existente. */
  embedded?: boolean
}) {
  const [showFilters, setShowFilters] = useState(false)
  const [bulkDefect, setBulkDefect] = useState<string>("Operando Normalmente")

  const sorted = useMemo(() => sortPrinters(printers, sort), [printers, sort])
  const activeFilterCount = [
    filters.serial,
    filters.model,
    filters.ip,
    filters.location,
  ].filter((value) => value !== "").length
  const hasFilters = activeFilterCount > 0 || filters.status !== "todos" || query !== ""

  const allIds = sorted.map((printer) => printer.id)

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {embedded ? null : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Série, modelo ou IP"
            aria-label="Pesquisar por série, modelo ou IP"
            className="h-8 w-52 pl-8 text-xs"
          />
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setShowFilters((value) => !value)}
      >
        <ListFilter className="size-3.5" />
        Filtros
        {activeFilterCount > 0 ? (
          <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-foreground">
            {activeFilterCount}
          </span>
        ) : null}
      </Button>
      <div className="relative">
        <ArrowDownUp className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <select
          aria-label="Ordenar por"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SortMode)}
          className="h-8 appearance-none rounded-md border border-input bg-background pr-2 pl-8 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  const body = (
    <>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-3">
          {toolbar}
        </div>
      ) : null}

      {showFilters ? (
        <div className="grid gap-2 border-b border-border bg-muted/40 px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["serial", "Série"],
              ["model", "Modelo"],
              ["ip", "IP"],
              ["location", "Localização"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </span>
              <Input
                value={filters[key]}
                onChange={(event) =>
                  onFiltersChange({ ...filters, [key]: event.target.value })
                }
                placeholder={`Filtrar ${label.toLowerCase()}`}
                className="h-8 text-xs"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({ ...filters, status: event.target.value })
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "todos" ? "Todos os status" : option}
                </option>
              ))}
            </select>
          </label>
          {hasFilters ? (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={() => {
                  onFiltersChange(EMPTY_FILTERS)
                  onQueryChange("")
                }}
              >
                <X className="size-3.5" />
                Limpar filtros
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-soft/50 px-4 py-2.5">
          <span className="text-[11px] font-semibold text-foreground">
            Preenchimento em lote
          </span>
          <select
            value={bulkDefect}
            onChange={(event) => setBulkDefect(event.target.value)}
            aria-label="Defeito para aplicar em lote"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {DEFECT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onBulkDefect(allIds, bulkDefect)}
          >
            <CheckCheck className="size-3.5" />
            Aplicar aos {sorted.length} filtrados
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onAutoDefects(allIds)}
          >
            <RotateCcw className="size-3.5" />
            Reaplicar automático
          </Button>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title="Nenhuma impressora encontrada"
          description="Ajuste a pesquisa ou os filtros para ver outros equipamentos da frota."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2">Série</th>
                <th className="px-3 py-2">Modelo</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Localização</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Toner %</th>
                <th className="px-3 py-2">Última atualização</th>
                <th className="px-3 py-2">Defeito encontrado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((printer) => {
                const criticalZero = printer.toner === 0
                const criticalLow =
                  printer.toner !== null &&
                  printer.toner > 0 &&
                  printer.toner <= 20

                return (
                  <tr
                    key={printer.id}
                    className={cn(
                      "border-b border-border/70 transition-colors",
                      rowTone(printer),
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {criticalZero || criticalLow ? (
                          <AlertTriangle
                            className={cn(
                              "size-3.5 shrink-0",
                              criticalZero ? "text-critical" : "text-warn",
                            )}
                            aria-label={
                              criticalZero ? "Toner zerado" : "Toner crítico"
                            }
                          />
                        ) : null}
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {printer.serial}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                      {printer.model}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {printer.ip || "—"}
                    </td>
                    <td className="max-w-[280px] px-3 py-2.5 text-xs text-foreground">
                      {printer.location || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <StatusChip status={printer.status} />
                        <select
                          value={statusChoiceOf(printer)}
                          aria-label={`Status de ${printer.serial}`}
                          onChange={(event) =>
                            onStatusChange(
                              printer.id,
                              event.target.value as PrinterStatusChoice,
                            )
                          }
                          className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="Monitorada">Monitorada</option>
                          <option value="Fora de Monitoramento">Fora</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <TonerCell printer={printer} />
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {printer.lastCheckedAt
                        ? formatDateTimeBr(printer.lastCheckedAt)
                        : formatDateBr(printer.lastCheck)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={printer.defect}
                          aria-label={`Defeito de ${printer.serial}`}
                          onChange={(event) =>
                            onDefectChange(printer.id, event.target.value, "manual")
                          }
                          className="h-7 max-w-[190px] rounded-md border border-input bg-background px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {!DEFECT_OPTIONS.includes(
                            printer.defect as (typeof DEFECT_OPTIONS)[number],
                          ) && printer.defect !== "" ? (
                            <option value={printer.defect}>{printer.defect}</option>
                          ) : null}
                          {DEFECT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                            printer.defectSource === "auto"
                              ? "bg-brand/10 text-brand"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {printer.defectSource}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  if (embedded) return body

  return (
    <Card>
      <CardHeader
        title="Frota de impressoras"
        subtitle={`${sorted.length} de ${printers.length} equipamentos exibidos`}
        action={toolbar}
      />
      {body}
    </Card>
  )
}
