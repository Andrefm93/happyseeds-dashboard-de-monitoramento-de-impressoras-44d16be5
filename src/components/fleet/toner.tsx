import { AlertOctagon, Droplet, Droplets, Gauge, Wrench } from "lucide-react"

import {
  BAND_STYLE,
  Card,
  CardHeader,
  EmptyState,
  StatusChip,
  TonerCell,
} from "./ui"
import { BAND_CHART_COLOR, bandLabel } from "./charts"
import {
  averageToner,
  CRITICAL_TONER_LIMIT,
  type FleetPrinter,
  TONER_BAND_LABEL,
  TONER_BAND_ORDER,
  tonerBand,
} from "#/lib/fleet"
import { cn } from "#/lib/utils"

export function TonerModule({
  printers,
  onDefectChange,
}: {
  printers: FleetPrinter[]
  onDefectChange: (id: number, defect: string, source: "manual") => void
}) {
  const withReading = printers.filter((printer) => printer.toner !== null)
  const critical = withReading
    .filter((printer) => (printer.toner ?? 100) < CRITICAL_TONER_LIMIT)
    .sort((a, b) => (a.toner ?? 0) - (b.toner ?? 0))
  const zeroed = withReading.filter((printer) => printer.toner === 0)
  const average = averageToner(printers)

  const distribution = TONER_BAND_ORDER.map((band) => {
    const items = printers.filter((printer) => tonerBand(printer.toner) === band)
    return {
      band,
      label: bandLabel(band),
      full: TONER_BAND_LABEL[band],
      color: BAND_CHART_COLOR[band],
      count: items.length,
    }
  })

  const total = printers.length || 1

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardHeader
          title="Módulo de toner"
          subtitle={`Equipamentos abaixo de ${CRITICAL_TONER_LIMIT}% e detalhamento dos críticos`}
          action={
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Média geral
                </p>
                <p className="text-xl font-extrabold tabular-nums text-foreground">
                  {average === null ? "—" : `${average.toFixed(1)}%`}
                </p>
              </div>
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20 ring-inset">
                <Gauge className="size-4" />
              </span>
            </div>
          }
        />

        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Críticos
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-warn">
              <Droplet className="size-4" />
              {critical.length}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Zerados
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-critical">
              <AlertOctagon className="size-4" />
              {zeroed.length}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Com leitura
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-ok">
              <Droplets className="size-4" />
              {withReading.length}
            </p>
          </div>
        </div>

        {critical.length === 0 ? (
          <EmptyState
            title="Nenhum toner abaixo do limite"
            description={`Todos os equipamentos com leitura estão com ${CRITICAL_TONER_LIMIT}% ou mais de toner.`}
          />
        ) : (
          <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
            {critical.map((printer) => (
              <li
                key={printer.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-foreground">
                    {printer.serial}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {printer.model} · {printer.location || "sem localização"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <TonerCell printer={printer} />
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() =>
                      onDefectChange(printer.id, "Toner Vazio", "manual")
                    }
                  >
                    <Wrench className="mr-1 inline size-3" />
                    Trocar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Distribuição por faixas"
          subtitle="Percentual da frota em cada faixa de toner"
        />
        <ul className="flex flex-col gap-3 px-4 py-4">
          {distribution.map((item) => (
            <li key={item.band} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="font-semibold text-foreground">
                    {item.full}
                  </span>
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {item.count}
                  <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                    {Math.round((item.count / total) * 100)}%
                  </span>
                </span>
              </div>
              <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(item.count / total) * 100}%`,
                    background: item.color,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-4 py-4">
          <h3 className="text-xs font-bold tracking-tight text-foreground">
            Detalhamento dos equipamentos críticos
          </h3>
          {critical.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sem equipamentos críticos no momento.
            </p>
          ) : (
            <div className="mt-2 max-h-[220px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="py-1.5 pr-2">Série</th>
                    <th className="py-1.5 pr-2">Modelo</th>
                    <th className="py-1.5 pr-2">Local</th>
                    <th className="py-1.5 text-right">Toner</th>
                  </tr>
                </thead>
                <tbody>
                  {critical.map((printer) => (
                    <tr key={printer.id} className="border-t border-border/70">
                      <td className="py-1.5 pr-2 font-mono font-semibold text-foreground">
                        {printer.serial}
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {printer.model}
                      </td>
                      <td className="max-w-[160px] truncate py-1.5 pr-2 text-muted-foreground">
                        {printer.location || "—"}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-bold tabular-nums",
                          BAND_STYLE[tonerBand(printer.toner)].text,
                        )}
                      >
                        {printer.toner}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export function MaintenancePriorities({
  printers,
}: {
  printers: FleetPrinter[]
}) {
  const zeroed = printers
    .filter((printer) => printer.toner === 0)
    .sort((a, b) => a.serial.localeCompare(b.serial, "pt-BR"))
  const low = printers
    .filter(
      (printer) => printer.toner !== null && printer.toner > 0 && printer.toner <= 20,
    )
    .sort((a, b) => (a.toner ?? 0) - (b.toner ?? 0))
  const verify = printers.filter(
    (printer) => printer.status !== "Monitorada" && printer.toner !== 0,
  )

  const groups = [
    {
      key: "zero",
      title: "Prioridade 1 · Toner zerado",
      description: "Substituição imediata do suprimento.",
      items: zeroed,
      chip: "bg-critical text-white",
      border: "border-l-critical",
    },
    {
      key: "low",
      title: "Prioridade 2 · Toner abaixo de 20%",
      description: "Programar troca na próxima janela de manutenção.",
      items: low,
      chip: "bg-warn text-white",
      border: "border-l-warn",
    },
    {
      key: "verify",
      title: "Prioridade 3 · Necessita verificação",
      description: "Sem leitura de toner ou com falha de comunicação.",
      items: verify,
      chip: "bg-idle text-white",
      border: "border-l-idle",
    },
  ]

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <Card>
      <CardHeader
        title="Prioridades de manutenção"
        subtitle={`${totalItems} equipamentos exigem ação`}
      />
      {totalItems === 0 ? (
        <EmptyState
          title="Frota sem pendências"
          description="Nenhum toner crítico e nenhum equipamento aguardando verificação."
        />
      ) : (
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.key}
              className={cn(
                "rounded-lg border border-border border-l-4 bg-muted/30 px-3 py-3",
                group.border,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-tight text-foreground">
                  {group.title}
                </h3>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    group.chip,
                  )}
                >
                  {group.items.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {group.description}
              </p>
              {group.items.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {group.items.slice(0, 6).map((printer) => (
                    <li
                      key={printer.id}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="truncate font-mono font-medium text-foreground">
                        {printer.serial}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                        {printer.toner === null ? "s/ leitura" : `${printer.toner}%`}
                      </span>
                    </li>
                  ))}
                  {group.items.length > 6 ? (
                    <li className="text-[10px] font-medium text-muted-foreground">
                      + {group.items.length - 6} outros equipamentos
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function FleetSummary({ printers }: { printers: FleetPrinter[] }) {
  const average = averageToner(printers)
  const models = new Map<string, number>()
  for (const printer of printers) {
    models.set(printer.model, (models.get(printer.model) ?? 0) + 1)
  }
  const topModels = [...models.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const withReading = printers.filter((printer) => printer.toner !== null).length

  return (
    <Card>
      <CardHeader
        title="Resumo da frota"
        subtitle="Média geral de toner e composição por modelo"
      />
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-lg bg-brand-soft/60 px-4 py-4 ring-1 ring-brand/15 ring-inset">
          <p className="text-[10px] font-semibold tracking-wide text-brand uppercase">
            Média geral
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-foreground">
            {average === null ? "—" : `${average.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {withReading} de {printers.length} com leitura
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${average ?? 0}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Modelos mais presentes
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {topModels.map(([model, count]) => (
              <li key={model} className="flex items-center gap-3">
                <span className="w-20 shrink-0 truncate text-xs font-semibold text-foreground">
                  {model}
                </span>
                <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{
                      width: `${printers.length > 0 ? (count / printers.length) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
                  {count}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {printers.slice(0, 1).map((printer) => (
              <StatusChip key={printer.id} status={printer.status} />
            ))}
            <span className="text-[11px] text-muted-foreground">
              {models.size} modelos distintos em {printers.length} equipamentos.
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
