import {
  BarChart3,
  Droplet,
  Droplets,
  Gauge,
  ListOrdered,
  PrinterIcon,
  ShieldCheck,
  Sparkles,
  Table2,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { cn } from "#/lib/utils"
import type { MonitorStatus } from "#/lib/fleet"

export type TopicKey =
  | "toner-faixas"
  | "modelos"
  | "resumo"
  | "prioridades"
  | "frota"
  | "monitoramento"
  | "fora"
  | "criticos"
  | "zerados"
  | "relatorios"

export interface TopicItem {
  key: TopicKey
  label: string
  description: string
  icon: LucideIcon
  badge?: number
  tone: "brand" | "ok" | "idle" | "warn" | "critical" | "neutral"
}

const TONE_STYLES: Record<TopicItem["tone"], { icon: string; badge: string }> = {
  brand: { icon: "bg-brand/10 text-brand", badge: "bg-brand text-white" },
  ok: { icon: "bg-ok/10 text-ok", badge: "bg-ok text-white" },
  idle: { icon: "bg-idle/12 text-idle", badge: "bg-idle text-white" },
  warn: { icon: "bg-warn/12 text-warn", badge: "bg-warn text-white" },
  critical: {
    icon: "bg-critical/10 text-critical",
    badge: "bg-critical text-white",
  },
  neutral: {
    icon: "bg-muted text-muted-foreground",
    badge: "bg-foreground text-background",
  },
}

export function TopicList({
  topics,
  onSelect,
  activeKey,
}: {
  topics: TopicItem[]
  onSelect: (key: TopicKey) => void
  activeKey?: TopicKey | null
}) {
  return (
    <nav aria-label="Tópicos do painel" className="flex flex-col gap-1.5">
      {topics.map((topic) => {
        const Icon = topic.icon
        const tone = TONE_STYLES[topic.tone]
        return (
          <button
            key={topic.key}
            type="button"
            onClick={() => onSelect(topic.key)}
            aria-current={activeKey === topic.key ? "true" : undefined}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-all",
              "hover:-translate-y-px hover:border-brand/40 hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activeKey === topic.key && "border-brand/50 bg-brand-soft/40",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                tone.icon,
              )}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-foreground">
                {topic.label}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {topic.description}
              </span>
            </span>
            {typeof topic.badge === "number" ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                  tone.badge,
                )}
              >
                {topic.badge}
              </span>
            ) : (
              <span className="shrink-0 text-[11px] font-bold text-muted-foreground transition-transform group-hover:translate-x-0.5">
                →
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

export const TOPIC_ICONS = {
  BarChart3,
  Droplet,
  Droplets,
  Gauge,
  ListOrdered,
  PrinterIcon,
  ShieldCheck,
  Sparkles,
  Table2,
  Wrench,
}

export const STATUS_TONE: Record<MonitorStatus, TopicItem["tone"]> = {
  Monitorada: "ok",
  "Necessita Verificação": "warn",
  "Fora de Monitoramento": "idle",
}
