import type { FleetSeedRow } from "./fleet-seed"

/** Status de monitoramento normalizado exibido na interface. */
export type MonitorStatus =
  | "Monitorada"
  | "Necessita Verificação"
  | "Fora de Monitoramento"

export interface FleetPrinter {
  id: number
  serial: string
  model: string
  ip: string
  location: string
  /** Valor original da planilha: Monitorada | Não Monitorada | BKP */
  monitoring: string
  status: MonitorStatus
  toner: number | null
  drums: number | null
  lastCheck: string
  /** Data e hora (ISO) da última alteração de status/leitura. */
  lastCheckedAt: string
  defect: string
  defectSource: "auto" | "manual"
  sourceRow: number | null
}

/** Cor de criticidade derivada do percentual de toner. */
export type TonerBand = "zerado" | "critico" | "atencao" | "saudavel" | "sem-leitura"

export const TONER_BAND_LABEL: Record<TonerBand, string> = {
  zerado: "Zerado (0%)",
  critico: "Crítico (1% a 20%)",
  atencao: "Atenção (21% a 40%)",
  saudavel: "Saudável (acima de 40%)",
  "sem-leitura": "Sem leitura de toner",
}

export const TONER_BAND_ORDER: TonerBand[] = [
  "zerado",
  "critico",
  "atencao",
  "saudavel",
  "sem-leitura",
]

export function tonerBand(toner: number | null): TonerBand {
  if (toner === null || Number.isNaN(toner)) return "sem-leitura"
  if (toner <= 0) return "zerado"
  if (toner <= 20) return "critico"
  if (toner <= 40) return "atencao"
  return "saudavel"
}

/**
 * Deriva o status operacional a partir da linha original + leitura de toner.
 * - "Não Monitorada" / "Fora de Monitoramento" => Fora de Monitoramento,
 *   mesmo que o equipamento ainda reporte leitura.
 * - Monitorada/BKP sem IP ou sem leitura => Necessita Verificação.
 */
export function deriveStatus(
  monitoring: string,
  toner: number | null,
  drums: number | null,
  defect: string,
): MonitorStatus {
  const normalized = monitoring.trim().toLowerCase()
  const hasReading = toner !== null || drums !== null

  if (
    normalized.startsWith("não monitorada") ||
    normalized.startsWith("nao monitorada") ||
    normalized.startsWith("fora de monitoramento") ||
    normalized.startsWith("fora do monitoramento")
  )
    return "Fora de Monitoramento"

  const communicationIssue = /sem comunica|falha de rede|equipamento desligado|sem leitura/i.test(
    defect,
  )

  if (normalized.startsWith("monitorada") && hasReading && !communicationIssue)
    return "Monitorada"

  if (normalized.startsWith("monitorada") && !hasReading)
    return "Necessita Verificação"

  return "Fora de Monitoramento"
}

/**
 * Preenchimento automático do defeito a partir do estado do equipamento:
 * sem leitura de toner, toner zero, percentual crítico ou inativo.
 */
export function autoDefect(input: {
  monitoring: string
  toner: number | null
  drums: number | null
  ip: string
  lastCheck: string
}): string {
  const status = deriveStatus(input.monitoring, input.toner, input.drums, "")

  if (status === "Fora de Monitoramento") return "Sem Comunicação"
  if (input.toner === 0) return "Toner Vazio"
  if (input.toner !== null && input.toner <= 20) return "Toner Vazio"
  if (status === "Necessita Verificação")
    return input.ip.trim() === "" ? "Equipamento Desligado" : "Falha de Rede"
  return "Operando Normalmente"
}

/** Converte valores de planilha ("59%", "1", "-", "") em número ou null. */
export function parsePercent(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (text === "" || text === "-" || text === "–" || text === "—") return null
  const match = text.match(/-?\d+(?:[.,]\d+)?/)
  if (!match) return null
  const value = Number(match[0].replace(",", "."))
  if (Number.isNaN(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Normaliza datas em dd/mm/aaaa, aaaa-mm-dd ou Date para ISO yyyy-mm-dd. */
export function parseDateIso(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  const text = String(raw).trim()
  if (text === "") return ""

  const br = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (br) {
    const day = br[1].padStart(2, "0")
    const month = br[2].padStart(2, "0")
    const rawYear = br[3]
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${month}-${day}`
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ""
}

export function formatDateBr(iso: string): string {
  if (!iso) return "—"
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return iso
  return `${match[3]}/${match[2]}/${match[1]}`
}

export function formatDateTimeBr(iso: string): string {
  if (!iso) return "—"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(parsed)
}

/** Média geral dos toners considerando apenas aparelhos com leitura. */
export function averageToner(printers: FleetPrinter[]): number | null {
  const values = printers
    .map((p) => p.toner)
    .filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const CRITICAL_TONER_LIMIT = 20

export function seedToPrinter(
  row: FleetSeedRow,
  index: number,
  sourceRow: number | null = null,
): Omit<FleetPrinter, "id"> {
  const defect = row.defect.trim()
  return {
    serial: row.serial,
    model: row.model,
    ip: row.ip,
    location: row.location,
    monitoring: row.monitoring,
    status: deriveStatus(row.monitoring, row.toner, row.drums, defect),
    toner: row.toner,
    drums: row.drums,
    lastCheck: row.lastCheck,
    lastCheckedAt: "",
    defect:
      defect ||
      autoDefect({
        monitoring: row.monitoring,
        toner: row.toner,
        drums: row.drums,
        ip: row.ip,
        lastCheck: row.lastCheck,
      }),
    defectSource: defect ? "manual" : "auto",
    sourceRow: sourceRow ?? index + 1,
  }
}
