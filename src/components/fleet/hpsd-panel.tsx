import {
  AlertTriangle,
  CheckCircle2,
  Droplet,
  FileSpreadsheet,
  ListChecks,
  Upload,
  Wifi,
  X,
} from "lucide-react"

import { Button } from "#/components/ui/button"
import { cn } from "#/lib/utils"
import { Card } from "./ui"
import type { HpsdReading } from "#/lib/hpsd"
import type { ReadingUpdateResult } from "#/lib/printers.functions"

export function HpsdCard({
  reading,
  fileName,
  busy,
  onOpen,
  onClear,
}: {
  reading: HpsdReading
  fileName: string
  busy: boolean
  onOpen: () => void
  onClear: () => void
}) {
  const total = reading.totalRows
  const missing = reading.withoutSerial
  const ready = reading.withToner

  return (
    <div className="rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold tracking-tight text-foreground">
            <FileSpreadsheet className="size-3.5 text-brand" />
            Planilha do HPSD reconhecida
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {fileName} · {reading.columns.length > 0 ? `${reading.columns.length} colunas` : "sem cabeçalho"} ·{" "}
            {total} equipamentos lidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onOpen}
            disabled={busy || ready === 0}
          >
            <ListChecks className="size-3.5" />
            Conferir e atualizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={onClear}
            disabled={busy}
          >
            <X className="size-3.5" />
            Descartar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip icon={Droplet} tone="ok" label={`${ready} com leitura de toner`} />
        {missing > 0 ? (
          <Chip
            icon={AlertTriangle}
            tone="warn"
            label={`${missing} sem número de série`}
          />
        ) : null}
        {reading.duplicates > 0 ? (
          <Chip
            icon={AlertTriangle}
            tone="warn"
            label={`${reading.duplicates} linhas repetidas`}
          />
        ) : null}
        <Chip
          icon={Wifi}
          tone={reading.layout.ipColumn >= 0 ? "brand" : "muted"}
          label={
            reading.layout.ipColumn >= 0
              ? `IP na coluna ${String.fromCharCode(65 + reading.layout.ipColumn)}`
              : "IP não encontrado"
          }
        />
        <Chip
          icon={ListChecks}
          tone={reading.layout.serialColumn >= 0 ? "brand" : "critical"}
          label={
            reading.layout.serialColumn >= 0
              ? `Série na coluna ${String.fromCharCode(65 + reading.layout.serialColumn)}`
              : "Série não encontrada"
          }
        />
      </div>
    </div>
  )
}

function Chip({
  icon: Icon,
  tone,
  label,
}: {
  icon: typeof Droplet
  tone: "ok" | "warn" | "brand" | "critical" | "muted"
  label: string
}) {
  const tones = {
    ok: "bg-ok/10 text-ok ring-ok/25",
    warn: "bg-warn/12 text-warn ring-warn/30",
    brand: "bg-brand/10 text-brand ring-brand/25",
    critical: "bg-critical/10 text-critical ring-critical/30",
    muted: "bg-muted text-muted-foreground ring-border",
  } as const

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone],
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

export function HpsdConfirmDialog({
  reading,
  fileName,
  busy,
  onClose,
  onConfirm,
}: {
  reading: HpsdReading
  fileName: string
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const preview = reading.entries.slice(0, 200)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/45 p-3 backdrop-blur-sm sm:p-6">
      <Card className="my-4 w-full max-w-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
              <FileSpreadsheet className="size-4 text-brand" />
              Atualizar toner pela planilha do HPSD
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fileName} · o painel casa cada linha pela{" "}
              <strong className="font-semibold text-foreground">série</strong> e,
              quando faltar, pelo{" "}
              <strong className="font-semibold text-foreground">IP</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["serialColumn", "Série"],
                ["ipColumn", "IP"],
                ["tonerColumn", "Toner"],
              ] as const
            ).map(([key, label]) => {
              const index = reading.layout[key]
              return (
                <span
                  key={key}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground"
                >
                  {label}:{" "}
                  <span
                    className={cn(
                      "font-bold",
                      index >= 0 ? "text-brand" : "text-critical",
                    )}
                  >
                    {index >= 0 ? `coluna ${String.fromCharCode(65 + index)}` : "não encontrada"}
                  </span>
                </span>
              )
            })}
          </div>

          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[600px] text-left text-[11px]">
              <thead className="sticky top-0 bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Número de série</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Toner lido</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((entry, index) => (
                  <tr key={`${entry.serial}-${index}`} className="border-t border-border/70">
                    <td className="px-3 py-1.5 font-mono font-semibold text-foreground">
                      {entry.serial || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                      {entry.ip || "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {entry.toner === null ? (
                        <span className="text-muted-foreground">sem leitura</span>
                      ) : (
                        <span className="font-bold text-foreground">
                          {entry.toner}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reading.entries.length > 200 ? (
            <p className="text-[11px] text-muted-foreground">
              Prévia das primeiras 200 linhas de {reading.entries.length}.
            </p>
          ) : null}

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
            Apenas os percentuais de toner e a data da última verificação são
            atualizados. Nenhum equipamento é apagado ou recadastrado.
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button className="gap-1.5" onClick={onConfirm} disabled={busy}>
            <Upload className="size-3.5" />
            Atualizar {reading.withToner} percentuais
          </Button>
        </footer>
      </Card>
    </div>
  )
}

export function ReadingResultBanner({
  result,
  onClose,
}: {
  result: ReadingUpdateResult
  onClose: () => void
}) {
  return (
    <div className="rounded-xl border border-ok/30 bg-ok/8 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold text-foreground">
            <CheckCircle2 className="size-3.5 text-ok" />
            Atualização concluída — {result.updated} percentuais alterados
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {result.matched} equipamentos localizados
            {result.notFound > 0 ? ` · ${result.notFound} séries fora da frota` : ""}
            {result.unmatchedIp > 0 ? ` · ${result.unmatchedIp} IPs não encontrados` : ""}
            {result.withoutToner > 0 ? ` · ${result.withoutToner} sem leitura` : ""}
            {result.conflicts > 0 ? ` · ${result.conflicts} com série e IP divergentes` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
