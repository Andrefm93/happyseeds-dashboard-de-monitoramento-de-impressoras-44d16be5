import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardHeader } from "./ui"
import { TONER_BAND_LABEL, type TonerBand } from "#/lib/fleet"

export interface ChartSlice {
  name: string
  value: number
  color: string
}

const AXIS_TICK = { fontSize: 11, fill: "oklch(0.52 0.02 262)" }

function chartTooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 10,
      border: "1px solid oklch(0.9 0.008 258)",
      fontSize: 12,
      boxShadow: "0 6px 18px rgba(16,24,40,0.08)",
    },
    labelStyle: { fontWeight: 700, marginBottom: 2 },
  }
}

export function StatusDonut({
  data,
  total,
}: {
  data: ChartSlice[]
  total: number
}) {
  const visible = data.filter((slice) => slice.value > 0)

  return (
    <Card>
      <CardHeader
        title="Impressoras por status"
        subtitle="Distribuição operacional da frota"
      />
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
        <div className="relative h-44 w-full shrink-0 sm:w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="name"
                innerRadius={46}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {visible.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip {...chartTooltipStyle()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold tabular-nums text-foreground">
              {total}
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              impressoras
            </span>
          </div>
        </div>
        <ul className="flex w-full flex-col gap-2">
          {data.map((slice) => (
            <li
              key={slice.name}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: slice.color }}
                />
                <span className="truncate font-medium text-foreground">
                  {slice.name}
                </span>
              </span>
              <span className="shrink-0 font-bold tabular-nums text-foreground">
                {slice.value}
                <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                  {total > 0 ? `${Math.round((slice.value / total) * 100)}%` : "0%"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export function TonerBandChart({ data }: { data: ChartSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <Card>
      <CardHeader
        title="Toners por faixa de percentual"
        subtitle="Quantidade de equipamentos em cada faixa"
      />
      <div className="h-56 px-2 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, left: -18, bottom: 4 }}
          >
            <XAxis
              dataKey="name"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "oklch(0.9 0.008 258)" }}
              interval={0}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip {...chartTooltipStyle()} cursor={{ fill: "oklch(0.95 0.008 258)" }} />
            <Bar dataKey="value" name="Impressoras" radius={[6, 6, 0, 0]}>
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        {total} equipamentos classificados por leitura de toner.
      </p>
    </Card>
  )
}

export function ModelBarChart({ data }: { data: ChartSlice[] }) {
  const height = Math.max(data.length * 26 + 24, 180)

  return (
    <Card>
      <CardHeader
        title="Quantidade por modelo"
        subtitle="Cada modelo presente na frota"
      />
      <div className="px-2 py-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={78}
            />
            <Tooltip {...chartTooltipStyle()} cursor={{ fill: "oklch(0.95 0.008 258)" }} />
            <Bar
              dataKey="value"
              name="Impressoras"
              fill="var(--chart-1)"
              radius={[0, 6, 6, 0]}
              barSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export const BAND_CHART_COLOR: Record<TonerBand, string> = {
  zerado: "var(--chart-4)",
  critico: "var(--chart-3)",
  atencao: "var(--chart-1)",
  saudavel: "var(--chart-2)",
  "sem-leitura": "var(--chart-5)",
}

export function bandLabel(band: TonerBand): string {
  const full = TONER_BAND_LABEL[band]
  return full.replace(/\s*\(.*\)$/, "")
}
