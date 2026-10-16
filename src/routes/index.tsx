import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import { RefreshCw, Search, Upload } from "lucide-react"

import {
  fetchPrinters,
  importPrinterRows,
  refreshPrinterMonitoring,
  restoreDemoFleet,
  setDefectsInBulk,
  setPrinterDefect,
  updateTonerReadings,
  type ReadingUpdateResult,
} from "#/lib/printers.functions"
import {
  autoDefect,
  averageToner,
  formatDateTimeBr,
  type FleetPrinter,
} from "#/lib/fleet"
import { KPI_ICONS, KpiCard, type Kpi } from "#/components/fleet/kpi"
import {
  ModelBarChart,
  StatusDonut,
  TonerBandChart,
  bandLabel,
} from "#/components/fleet/charts"
import {
  EMPTY_FILTERS,
  PrintersTable,
  matchesFilters,
  type FleetFilters,
  type SortMode,
} from "#/components/fleet/printers-table"
import {
  ImportModal,
  rowsToPrinters,
  type ParsedSheet,
} from "#/components/fleet/import-modal"
import { ReportsPanel } from "#/components/fleet/reports"
import { InfoModal } from "#/components/fleet/info-modal"
import {
  HpsdCard,
  HpsdConfirmDialog,
  ReadingResultBanner,
} from "#/components/fleet/hpsd-panel"
import type { HpsdReading } from "#/lib/hpsd"
import { Card, CardHeader } from "#/components/fleet/ui"
import {
  FleetSummary,
  MaintenancePriorities,
  TonerModule,
} from "#/components/fleet/toner"
import { TOPIC_ICONS, TopicList, type TopicItem, type TopicKey } from "#/components/fleet/topics"
import { buildReports, exportAllReports, exportReport } from "#/lib/excel"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"

export const Route = createFileRoute("/")({
  loader: () => fetchPrinters(),
  component: Dashboard,
})

function Dashboard() {
  const printers = Route.useLoaderData()
  const router = useRouter()

  const [filters, setFilters] = useState<FleetFilters>(EMPTY_FILTERS)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortMode>("criticidade")
  const [importOpen, setImportOpen] = useState(false)
  const [openTopic, setOpenTopic] = useState<TopicKey | null>(null)
  const [hpsd, setHpsd] = useState<HpsdReading | null>(null)
  const [hpsdFileName, setHpsdFileName] = useState("")
  const [hpsdOpen, setHpsdOpen] = useState(false)
  const [readingResult, setReadingResult] = useState<ReadingUpdateResult | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>(() =>
    new Date().toISOString(),
  )

  const filtered = printers.filter((printer) =>
    matchesFilters(printer, filters, query),
  )

  const monitored = printers.filter((p) => p.status === "Monitorada").length
  const outOfMonitoring = printers.length - monitored
  const criticalToners = printers.filter(
    (p) => p.toner !== null && p.toner > 0 && p.toner <= 20,
  ).length
  const zeroedToners = printers.filter((p) => p.toner === 0).length
  const verifyCount = printers.filter(
    (p) => p.status === "Necessita Verificação",
  ).length
  const average = averageToner(printers)

  const kpis: Kpi[] = [
    {
      key: "total",
      label: "Total de impressoras",
      value: String(printers.length),
      hint: "Equipamentos cadastrados na frota",
      icon: KPI_ICONS.PrinterIcon,
      tone: "brand",
    },
    {
      key: "monitoring",
      label: "Em monitoramento",
      value: String(monitored),
      hint: `${printers.length > 0 ? Math.round((monitored / printers.length) * 100) : 0}% da frota com leitura válida`,
      icon: KPI_ICONS.ShieldCheck,
      tone: "ok",
    },
    {
      key: "out",
      label: "Fora de monitoramento",
      value: String(outOfMonitoring),
      hint:
        verifyCount > 0
          ? `${verifyCount} necessitam verificação`
          : "Sem pendências de comunicação",
      icon: KPI_ICONS.CircleSlash,
      tone: "idle",
    },
    {
      key: "critical",
      label: "Toners críticos",
      value: String(criticalToners),
      hint: "Entre 1% e 20% de toner",
      icon: KPI_ICONS.AlertTriangle,
      tone: "warn",
    },
    {
      key: "zero",
      label: "Toners zerados",
      value: String(zeroedToners),
      hint: "Substituição imediata",
      icon: KPI_ICONS.Droplet,
      tone: "critical",
    },
    {
      key: "check",
      label: "Última atualização",
      value: formatDateTimeBr(lastCheck).split(",")[1]?.trim() ?? "—",
      hint: formatDateTimeBr(lastCheck).split(",")[0] ?? "—",
      icon: KPI_ICONS.Clock,
      tone: "neutral",
    },
  ]

  const statusData = [
    { name: "Monitorada", value: monitored, color: "var(--chart-2)" },
    {
      name: "Fora de Monitoramento",
      value: printers.filter((p) => p.status === "Fora de Monitoramento").length,
      color: "var(--chart-5)",
    },
    {
      name: "Necessita Verificação",
      value: verifyCount,
      color: "var(--chart-3)",
    },
  ]

  const bandData = [
    {
      name: bandLabel("zerado"),
      value: zeroedToners,
      color: "var(--chart-4)",
    },
    { name: bandLabel("critico"), value: criticalToners, color: "var(--chart-3)" },
    {
      name: bandLabel("atencao"),
      value: printers.filter(
        (p) => p.toner !== null && p.toner > 20 && p.toner <= 40,
      ).length,
      color: "var(--chart-1)",
    },
    {
      name: bandLabel("saudavel"),
      value: printers.filter((p) => p.toner !== null && p.toner > 40).length,
      color: "var(--chart-2)",
    },
    {
      name: bandLabel("sem-leitura"),
      value: printers.filter((p) => p.toner === null).length,
      color: "var(--chart-5)",
    },
  ]

  const modelCounts = new Map<string, number>()
  for (const printer of printers) {
    modelCounts.set(printer.model, (modelCounts.get(printer.model) ?? 0) + 1)
  }
  const modelData = [...modelCounts.entries()]
    .map(([name, value]) => ({ name, value, color: "var(--chart-1)" }))
    .sort((a, b) => b.value - a.value)

  const reports = buildReports(printers)

  const topics: TopicItem[] = [
    {
      key: "toner-faixas",
      label: "Toners por faixa de percentual",
      description: "Distribuição dos equipamentos por faixa",
      icon: TOPIC_ICONS.BarChart3,
      tone: "brand",
    },
    {
      key: "modelos",
      label: "Quantidade por modelo",
      description: "Modelos presentes na frota",
      icon: TOPIC_ICONS.Table2,
      tone: "brand",
      badge: modelData.length,
    },
    {
      key: "resumo",
      label: "Resumo da frota",
      description: "Média geral de toner e composição",
      icon: TOPIC_ICONS.Gauge,
      tone: "neutral",
    },
    {
      key: "prioridades",
      label: "Prioridades de manutenção",
      description: "O que exige ação imediata",
      icon: TOPIC_ICONS.Wrench,
      tone: "warn",
      badge: zeroedToners + criticalToners + verifyCount,
    },
    {
      key: "frota",
      label: "Frota de impressoras",
      description: "Tabela completa com filtros e defeitos",
      icon: TOPIC_ICONS.PrinterIcon,
      tone: "neutral",
      badge: printers.length,
    },
    {
      key: "monitoramento",
      label: "Impressoras em monitoramento",
      description: "Com leitura válida de toner",
      icon: TOPIC_ICONS.ShieldCheck,
      tone: "ok",
      badge: monitored,
    },
    {
      key: "fora",
      label: "Fora de monitoramento",
      description: "Sem leitura ou não monitoradas",
      icon: TOPIC_ICONS.ListOrdered,
      tone: "idle",
      badge: outOfMonitoring,
    },
    {
      key: "criticos",
      label: "Toners críticos e zerados",
      description: "Detalhamento dos equipamentos críticos",
      icon: TOPIC_ICONS.Droplet,
      tone: "critical",
      badge: criticalToners + zeroedToners,
    },
    {
      key: "relatorios",
      label: "Relatórios e exportação",
      description: "Excel individual ou com todas as abas",
      icon: TOPIC_ICONS.Sparkles,
      tone: "brand",
      badge: reports.length,
    },
  ]

  async function reload() {
    await router.invalidate({ sync: true })
  }

  async function handleRefresh() {
    setBusy(true)
    try {
      const result = await refreshPrinterMonitoring({ data: {} })
      setLastCheck(result.checkedAt)
      await reload()
      toast.success(
        `Monitoramento atualizado — ${result.updated} impressoras verificadas.`,
        { description: "Data e hora da última verificação renovadas." },
      )
    } catch {
      toast.error("Não foi possível atualizar o monitoramento.")
    } finally {
      setBusy(false)
    }
  }

  /** Atualiza só os percentuais, casando pela série e depois pelo IP. */
  async function handleApplyReadings() {
    if (!hpsd) return
    setBusy(true)
    try {
      const result = await updateTonerReadings({ data: { entries: hpsd.entries } })
      setLastCheck(new Date().toISOString())
      setHpsdOpen(false)
      setHpsd(null)
      setHpsdFileName("")
      setImportOpen(false)
      await reload()
      setReadingResult(result)
      toast.success(`${result.updated} percentuais de toner atualizados.`, {
        description: `${result.matched} equipamentos localizados pela série ou pelo IP.`,
      })
    } catch {
      toast.error("Não foi possível atualizar os percentuais agora.")
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(sheet: ParsedSheet) {
    setBusy(true)
    try {
      const rows = rowsToPrinters(sheet)
      const total = await importPrinterRows({ data: { rows } })
      setImportOpen(false)
      setLastCheck(new Date().toISOString())
      await reload()
      toast.success(`${total} impressoras importadas com sucesso.`)
    } catch {
      toast.error("A importação falhou. Nenhum dado foi alterado.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRestoreDemo() {
    setBusy(true)
    try {
      const total = await restoreDemoFleet()
      setImportOpen(false)
      setLastCheck(new Date().toISOString())
      await reload()
      toast.success(`Base de demonstração recarregada — ${total} impressoras.`)
    } catch {
      toast.error("Não foi possível recarregar a base de demonstração.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDefectChange(id: number, defect: string, source: "manual") {
    try {
      await setPrinterDefect({ data: { id, defect, source } })
      await reload()
    } catch {
      toast.error("Não foi possível salvar o defeito.")
    }
  }

  async function handleBulkDefect(ids: number[], defect: string) {
    try {
      const updated = await setDefectsInBulk({
        data: { ids, defect, source: "manual" },
      })
      await reload()
      toast.success(`Defeito aplicado em ${updated} impressoras.`)
    } catch {
      toast.error("Não foi possível aplicar o defeito em lote.")
    }
  }

  /** Reaplica o preenchimento automático de defeito nos itens filtrados. */
  async function handleAutoDefects(ids: number[]) {
    const targets = printers.filter((printer) => ids.includes(printer.id))
    if (targets.length === 0) return
    try {
      const byDefect = new Map<string, number[]>()
      for (const printer of targets) {
        const defect = autoDefect({
          monitoring: printer.monitoring,
          toner: printer.toner,
          drums: printer.drums,
          ip: printer.ip,
          lastCheck: printer.lastCheck,
        })
        byDefect.set(defect, [...(byDefect.get(defect) ?? []), printer.id])
      }
      for (const [defect, groupIds] of byDefect) {
        await setDefectsInBulk({ data: { ids: groupIds, defect, source: "auto" } })
      }
      await reload()
      toast.success(
        `Defeito automático reaplicado em ${targets.length} impressoras.`,
      )
    } catch {
      toast.error("Não foi possível reaplicar os defeitos automáticos.")
    }
  }

  function openStatusFilter(status: string) {
    setFilters({ ...EMPTY_FILTERS, status })
    setQuery("")
    setOpenTopic("frota")
  }

  return (
    <main className="min-h-screen bg-canvas text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <KPI_ICONS.PrinterIcon className="size-4.5" />
            </span>
            <div>
              <h1 className="text-sm leading-tight font-extrabold tracking-tight text-foreground sm:text-base">
                Painel de Impressoras
              </h1>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Frota Rio Branco · {printers.length} equipamentos
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-xs"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Importar planilha
            </Button>
            <Button
              className="h-9 gap-1.5 text-xs"
              onClick={handleRefresh}
              disabled={busy}
            >
              <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
              Atualizar monitoramento
            </Button>
          </div>
        </div>
        <div className="border-t border-border/70 bg-muted/40">
          <p className="mx-auto max-w-[1500px] px-4 py-1.5 text-[11px] text-muted-foreground sm:px-6">
            Última verificação: {formatDateTimeBr(lastCheck)} · Os tópicos na
            lateral direita abrem cada informação em uma janela.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {readingResult ? (
            <ReadingResultBanner
              result={readingResult}
              onClose={() => setReadingResult(null)}
            />
          ) : null}

          {hpsd ? (
            <HpsdCard
              reading={hpsd}
              fileName={hpsdFileName}
              busy={busy}
              onOpen={() => setHpsdOpen(true)}
              onClear={() => {
                setHpsd(null)
                setHpsdFileName("")
              }}
            />
          ) : null}

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </section>

          <StatusDonut data={statusData} total={printers.length} />

          <Card>
            <CardHeader
              title="Atalhos do painel"
              subtitle="Clique em um cartão para abrir a janela com o detalhamento"
            />
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => {
                const Icon = topic.icon
                return (
                  <button
                    key={topic.key}
                    type="button"
                    onClick={() => setOpenTopic(topic.key)}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-[0_6px_16px_rgba(16,24,40,0.08)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <Icon className="size-4" />
                      </span>
                      {typeof topic.badge === "number" ? (
                        <span className="text-lg font-extrabold tabular-nums text-foreground">
                          {topic.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {topic.label}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      {topic.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-28 xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Tópicos
            </h2>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
              {topics.length}
            </span>
          </div>
          <TopicList
            topics={topics}
            onSelect={(key) => setOpenTopic(key)}
            activeKey={openTopic}
          />
          <div className="rounded-lg border border-dashed border-border bg-card px-3 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Média geral de toner:{" "}
              <strong className="text-foreground">
                {average === null ? "—" : `${average.toFixed(1)}%`}
              </strong>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {filtered.length} de {printers.length} impressoras nos filtros
              ativos.
            </p>
          </div>
        </aside>
      </div>

      <InfoModal
        open={openTopic === "toner-faixas"}
        title="Toners por faixa de percentual"
        subtitle="Quantidade de equipamentos em cada faixa de toner"
        onClose={() => setOpenTopic(null)}
      >
        <TonerBandChart data={bandData} />
      </InfoModal>

      <InfoModal
        open={openTopic === "modelos"}
        title="Quantidade por modelo"
        subtitle={`${modelData.length} modelos distintos na frota`}
        onClose={() => setOpenTopic(null)}
      >
        <ModelBarChart data={modelData} />
      </InfoModal>

      <InfoModal
        open={openTopic === "resumo"}
        title="Resumo da frota"
        subtitle="Média geral de toner e composição por modelo"
        onClose={() => setOpenTopic(null)}
      >
        <FleetSummary printers={printers} />
      </InfoModal>

      <InfoModal
        open={openTopic === "prioridades"}
        title="Prioridades de manutenção"
        subtitle="Equipamentos que exigem ação"
        onClose={() => setOpenTopic(null)}
        size="xl"
      >
        <MaintenancePriorities printers={printers} />
      </InfoModal>

      <InfoModal
        open={openTopic === "frota"}
        title="Frota de impressoras"
        subtitle="Filtros, ordenação por criticidade e defeitos por linha"
        onClose={() => setOpenTopic(null)}
        size="xl"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Série, modelo ou IP"
              aria-label="Pesquisa na frota"
              className="h-9 pl-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setQuery("")
            }}
          >
            Limpar filtros
          </Button>
        </div>
        <PrintersTable
          printers={filtered}
          filters={filters}
          onFiltersChange={setFilters}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          onDefectChange={handleDefectChange}
          onBulkDefect={handleBulkDefect}
          onAutoDefects={handleAutoDefects}
        />
      </InfoModal>

      <InfoModal
        open={openTopic === "monitoramento"}
        title="Impressoras em monitoramento"
        subtitle={`${monitored} equipamentos com leitura válida`}
        onClose={() => setOpenTopic(null)}
        size="xl"
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Em monitoramento" value={String(monitored)} tone="ok" />
          <MiniStat label="Fora de monitoramento" value={String(outOfMonitoring)} tone="idle" />
          <MiniStat label="Necessitam verificação" value={String(verifyCount)} tone="warn" />
          <MiniStat label="Média de toner" value={average === null ? "—" : `${average.toFixed(1)}%`} tone="brand" />
        </div>
        <RelatorioLista
          printers={printers.filter((p) => p.status === "Monitorada")}
          emptyLabel="Nenhuma impressora em monitoramento."
        />
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => openStatusFilter("Monitorada")}
          >
            Abrir na tabela completa
          </Button>
        </div>
      </InfoModal>

      <InfoModal
        open={openTopic === "fora"}
        title="Fora de monitoramento"
        subtitle={`${outOfMonitoring} equipamentos sem leitura ou não monitorados`}
        onClose={() => setOpenTopic(null)}
        size="xl"
      >
        <RelatorioLista
          printers={printers.filter((p) => p.status !== "Monitorada")}
          emptyLabel="Todas as impressoras estão em monitoramento."
        />
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => openStatusFilter("Fora de Monitoramento")}
          >
            Abrir na tabela completa
          </Button>
        </div>
      </InfoModal>

      <InfoModal
        open={openTopic === "criticos"}
        title="Toners críticos e zerados"
        subtitle="Equipamentos que precisam de troca de suprimento"
        onClose={() => setOpenTopic(null)}
        size="xl"
      >
        <TonerModule printers={filtered} onDefectChange={handleDefectChange} />
      </InfoModal>

      <InfoModal
        open={openTopic === "relatorios"}
        title="Relatórios e exportação"
        subtitle="Um arquivo Excel por relatório ou todos em abas separadas"
        onClose={() => setOpenTopic(null)}
        size="xl"
      >
        <ReportsPanel
          reports={reports}
          onExportOne={exportReport}
          onExportAll={() => exportAllReports(reports, lastCheck)}
        />
      </InfoModal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        onRestoreDemo={handleRestoreDemo}
        onHpsdDetected={(reading, fileName) => {
          setHpsd(reading)
          setHpsdFileName(fileName)
          setReadingResult(null)
          toast.success("Planilha do HPSD reconhecida.", {
            description: `${reading.withToner} leituras de toner prontas para atualizar.`,
          })
        }}
        hpsd={hpsd}
        hpsdFileName={hpsdFileName}
        onOpenHpsd={() => setHpsdOpen(true)}
        onClearHpsd={() => {
          setHpsd(null)
          setHpsdFileName("")
        }}
        busy={busy}
      />

      {hpsdOpen && hpsd ? (
        <HpsdConfirmDialog
          reading={hpsd}
          fileName={hpsdFileName}
          busy={busy}
          onClose={() => setHpsdOpen(false)}
          onConfirm={handleApplyReadings}
        />
      ) : null}
    </main>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "ok" | "idle" | "warn" | "brand"
}) {
  const tones = {
    ok: "text-ok",
    idle: "text-idle",
    warn: "text-warn",
    brand: "text-brand",
  }
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
    </div>
  )
}

function RelatorioLista({
  printers,
  emptyLabel,
}: {
  printers: FleetPrinter[]
  emptyLabel: string
}) {
  if (printers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-left text-[11px]">
        <thead className="sticky top-0 bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-2.5 py-2">Série</th>
            <th className="px-2.5 py-2">Modelo</th>
            <th className="px-2.5 py-2">IP</th>
            <th className="px-2.5 py-2">Localização</th>
            <th className="px-2.5 py-2">Toner</th>
            <th className="px-2.5 py-2">Defeito</th>
          </tr>
        </thead>
        <tbody>
          {printers.map((printer) => (
            <tr key={printer.id} className="border-t border-border/70">
              <td className="px-2.5 py-2 font-mono font-semibold text-foreground">
                {printer.serial}
              </td>
              <td className="px-2.5 py-2 text-foreground">{printer.model}</td>
              <td className="px-2.5 py-2 font-mono text-muted-foreground">
                {printer.ip || "—"}
              </td>
              <td className="max-w-[220px] truncate px-2.5 py-2 text-muted-foreground">
                {printer.location || "—"}
              </td>
              <td className="px-2.5 py-2 font-bold tabular-nums text-foreground">
                {printer.toner === null ? "sem leitura" : `${printer.toner}%`}
              </td>
              <td className="px-2.5 py-2 text-muted-foreground">
                {printer.defect || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
