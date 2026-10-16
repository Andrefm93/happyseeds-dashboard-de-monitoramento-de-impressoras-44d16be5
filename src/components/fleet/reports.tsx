import { Download, FileSpreadsheet } from "lucide-react"

import { Button } from "#/components/ui/button"
import { Card, CardHeader } from "./ui"
import type { ReportDefinition } from "#/lib/excel"
import { cn } from "#/lib/utils"

const TONE_STYLE: Record<ReportDefinition["tone"], string> = {
  ok: "bg-ok/10 text-ok ring-ok/20",
  idle: "bg-idle/10 text-idle ring-idle/20",
  warn: "bg-warn/12 text-warn ring-warn/25",
  critical: "bg-critical/10 text-critical ring-critical/25",
}

export function ReportsPanel({
  reports,
  onExportOne,
  onExportAll,
}: {
  reports: ReportDefinition[]
  onExportOne: (report: ReportDefinition) => void
  onExportAll: () => void
}) {
  return (
    <Card>
      <CardHeader
        title="Relatórios"
        subtitle="Exportação individual ou de todos em um único arquivo Excel"
        action={
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onExportAll}>
            <FileSpreadsheet className="size-3.5" />
            Exportar todos (uma aba por relatório)
          </Button>
        }
      />
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => (
          <article
            key={report.key}
            className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-bold tracking-tight text-foreground">
                  {report.title}
                </h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-inset",
                    TONE_STYLE[report.tone],
                  )}
                >
                  {report.printers.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {report.description}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 text-xs"
              onClick={() => onExportOne(report)}
            >
              <Download className="size-3.5" />
              Exportar
            </Button>
          </article>
        ))}
      </div>
    </Card>
  )
}
