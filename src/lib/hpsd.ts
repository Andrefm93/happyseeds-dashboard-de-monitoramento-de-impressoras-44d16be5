import * as XLSX from "xlsx"

import { parsePercent } from "#/lib/fleet"

/* ---------------------------------------------------------------- */
/* Reconhecimento de planilhas do HPSD                              */
/* ---------------------------------------------------------------- */

const MAX_HEADER_SCAN = 25
const MAX_PROBE_ROWS = 30

const IP_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const MAC_PATTERN = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i
const DATE_PATTERN =
  /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}([ T]\d{1,2}:\d{2}(:\d{2})?)?$/

const SERIAL_HEADERS = [
  "numero de serie",
  "nº de serie",
  "no de serie",
  "n de serie",
  "num de serie",
  "numeroserie",
  "serial number",
  "serialnumber",
  "serial no",
  "serial",
  "serie",
  "ns",
  "nsr",
]

const IP_HEADERS = [
  "endereco ip",
  "endereço ip",
  "ip address",
  "ipaddress",
  "endereco de ip",
  "ip fixo",
  "ip",
]

const TONER_HEADERS = [
  "porcentagem de toner restante",
  "percentual de toner",
  "nivel de toner",
  "nível de toner",
  "toner restante",
  "toner level",
  "toner percent",
  "toner",
]

/** Cabeçalhos de toner reconhecidos (mantidos para conferência do rótulo). */
export function isTonerHeader(value: string): boolean {
  const header = normalizeHeader(value)
  return TONER_HEADERS.some((candidate) => header.includes(candidate))
}

const IGNORED_REPORT_HEADERS = [
  "hpsd",
  "smart device services",
  "relatorio",
  "relatório",
  "report",
  "exportado em",
  "exported",
  "gerado em",
  "pagina",
  "página",
]

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.:]+$/, "")
}

export function isIpv4(value: string): boolean {
  const match = value.trim().match(IP_PATTERN)
  if (!match) return false
  return match.slice(1).every((part) => Number(part) <= 255)
}

function isSerialLike(value: string): boolean {
  const text = value.trim()
  if (text.length < 5 || text.length > 40) return false
  if (isIpv4(text) || MAC_PATTERN.test(text) || DATE_PATTERN.test(text))
    return false
  if (!/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(text)) return false
  const digits = text.replace(/\D/g, "").length
  return digits >= 3
}

function isMostlyNumeric(value: string): boolean {
  const text = value.trim()
  if (text === "") return false
  if (isIpv4(text) || DATE_PATTERN.test(text)) return false
  return /^-?\d+(?:[.,]\d+)?%?$/.test(text.replace(/\s/g, ""))
}

function findHeaderRow(rows: string[][]): number {
  let best = -1
  let bestScore = 0

  const limit = Math.min(rows.length, MAX_HEADER_SCAN)
  for (let index = 0; index < limit; index += 1) {
    const cells = rows[index].map(normalizeHeader)
    const serial = cells.some((cell) =>
      SERIAL_HEADERS.some((candidate) => cell === candidate),
    )
    const ip = cells.some((cell) =>
      IP_HEADERS.some((candidate) => cell === candidate),
    )
    if (!serial && !ip) continue

    const score = serial && ip ? 3 : ip ? 2 : 1
    if (score > bestScore) {
      bestScore = score
      best = index
    }
  }

  return best
}

function isNoiseRow(cells: string[]): boolean {
  const joined = cells.map(normalizeHeader).join(" ").trim()
  if (joined === "") return true
  if (IGNORED_REPORT_HEADERS.some((marker) => joined.includes(marker)))
    return true
  return false
}

function firstDataRow(rows: string[][], from: number): number {
  for (let index = from; index < rows.length; index += 1) {
    const cells = rows[index].map((cell) => String(cell ?? "").trim())
    if (cells.some((cell) => cell !== "")) return index
  }
  return Math.min(from, Math.max(rows.length - 1, 0))
}

export interface DetectedLayout {
  serialColumn: number
  ipColumn: number
  tonerColumn: number
}

/**
 * Descobre quais colunas guardam o número de série, o IP e o percentual de
 * toner — pelo cabeçalho quando existir e pela forma dos dados nas primeiras
 * linhas. Assim funciona com a planilha do HPSD, que vem em ordem diferente.
 */
export function detectLayout(rows: string[][]): DetectedLayout {
  const dataStart = firstDataRow(rows, 0)
  const probe = rows.slice(dataStart, dataStart + MAX_PROBE_ROWS)
  const depth = probe.reduce((max, row) => Math.max(max, row.length), 0)

  const stats = Array.from({ length: depth + 1 }, () => ({
    ip: 0,
    serial: 0,
    mac: 0,
    percent: 0,
    numeric: 0,
  }))

  for (const row of probe) {
    const seen = new Set<string>()
    row.forEach((cell, index) => {
      const value = String(cell ?? "").trim()
      if (value === "" || stats[index] === undefined) return
      if (isIpv4(value)) stats[index].ip += 1
      if (MAC_PATTERN.test(value)) stats[index].mac += 1
      if (isSerialLike(value) && !seen.has(value)) {
        seen.add(value)
        stats[index].serial += 1
      }
      const percent = parsePercent(value)
      if (percent !== null) stats[index].percent += 1
      if (isMostlyNumeric(value)) stats[index].numeric += 1
    })
  }

  const sampleSize = Math.max(probe.length, 1)
  const ipColumn = stats.findIndex((stat) => stat.ip >= Math.ceil(sampleSize / 2))

  const serialColumn = stats.reduce(
    (best, stat, index) =>
      index !== ipColumn && stat.mac === 0 && stat.serial > (stats[best]?.serial ?? -1)
        ? index
        : best,
    -1,
  )

  // O percentual de toner é a coluna numérica mais baixa que não seja a série
  // nem o IP: cobre "59", "59%" e a leitura colorida do HPSD (ex.: 58/50).
  let tonerColumn = -1
  let tonerScore = 0
  stats.forEach((stat, index) => {
    if (index === ipColumn || index === serialColumn) return
    if (stat.numeric === 0 || stat.ip > 0 || stat.mac > 0) return
    const average = stat.numeric / sampleSize
    if (
      average > 0.5 &&
      (tonerScore === 0 || stat.numeric < tonerScore)
    ) {
      tonerScore = stat.numeric
      tonerColumn = index
    }
  })

  return { serialColumn, ipColumn, tonerColumn }
}

/* ---------------------------------------------------------------- */
/* Leitura do arquivo                                                */
/* ---------------------------------------------------------------- */

export interface HpsdEntry {
  serial: string
  ip: string
  toner: number | null
}

export interface HpsdReading {
  /** Linha do cabeçalho no arquivo; -1 quando não há. */
  headerRow: number
  /** Primeira linha com dados. */
  firstDataRow: number
  totalRows: number
  layout: DetectedLayout
  entries: HpsdEntry[]
  withToner: number
  withoutSerial: number
  duplicates: number
  columns: string[]
}

/** Lê a planilha e devolve série, IP e toner linha por linha. */
export function readHpsdWorkbook(rows: string[][]): HpsdReading {
  const headerRow = findHeaderRow(rows)
  const dataStart = firstDataRow(rows, headerRow >= 0 ? headerRow + 1 : 0)
  const layout = detectLayout(rows)

  const seen = new Map<string, number>()
  const entries: HpsdEntry[] = []
  let withoutSerial = 0
  let duplicates = 0

  for (let index = dataStart; index < rows.length; index += 1) {
    const cells = rows[index].map((cell) => String(cell ?? "").trim())
    if (isNoiseRow(cells)) continue

    const serial =
      layout.serialColumn >= 0 ? (cells[layout.serialColumn] ?? "") : ""
    const ip = layout.ipColumn >= 0 ? (cells[layout.ipColumn] ?? "") : ""
    const tonerRaw =
      layout.tonerColumn >= 0 ? (cells[layout.tonerColumn] ?? "") : ""

    if (serial === "" && ip === "" && tonerRaw === "") continue

    if (serial === "") {
      withoutSerial += 1
      continue
    }

    const key = serial.toUpperCase()
    if (seen.has(key)) {
      duplicates += 1
      continue
    }
    seen.set(key, entries.length)

    entries.push({
      serial,
      ip: isIpv4(ip) ? ip : "",
      toner: parsePercent(tonerRaw),
    })
  }

  const columns =
    headerRow >= 0
      ? rows[headerRow].map((cell) => String(cell ?? "").trim())
      : []

  return {
    headerRow,
    firstDataRow: dataStart,
    totalRows: entries.length,
    layout,
    entries,
    withToner: entries.filter((entry) => entry.toner !== null).length,
    withoutSerial,
    duplicates,
    columns,
  }
}

export function readSpreadsheetRows(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error("A planilha não possui abas.")
  const worksheet = workbook.Sheets[firstSheet]
  const raw = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  })
  const rows = (raw as unknown as string[][]).map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [],
  )
  const cleaned = rows.filter((row) =>
    row.some((cell) => String(cell).trim() !== ""),
  )
  if (cleaned.length === 0)
    throw new Error("Nenhuma linha com dados foi encontrada no arquivo.")
  return cleaned
}
