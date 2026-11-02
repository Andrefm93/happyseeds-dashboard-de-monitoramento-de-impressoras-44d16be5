import { useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Table2,
  Upload,
  X,
} from "lucide-react"

import { Button } from "#/components/ui/button"
import { Card } from "./ui"
import { autoDefect, parsePercent } from "#/lib/fleet"
import { downloadTemplate } from "#/lib/excel"
import { HpsdCard } from "./hpsd-panel"
import {
  readHpsdWorkbook,
  readSpreadsheetRows,
  type HpsdReading,
} from "#/lib/hpsd"
import { cn } from "#/lib/utils"

/** Colunas esperadas, na ordem A–F do modelo de planilha. */
export const EXPECTED_COLUMNS = [
  { key: "serial", letter: "A", label: "Série" },
  { key: "model", letter: "B", label: "Modelo" },
  { key: "ip", letter: "C", label: "IP" },
  { key: "location", letter: "D", label: "Apelido" },
  { key: "status", letter: "E", label: "Status" },
  { key: "toner", letter: "F", label: "Toner (%)" },
] as const

export interface ParsedRow {
  /** Número da linha no arquivo (1 = primeira linha de dados após o cabeçalho). */
  rowNumber: number
  values: string[]
  valid: boolean
  errors: string[]
}

export interface ColumnMapping {
  serial: number
  model: number
  ip: number
  location: number
  status: number
  toner: number
}

export interface ParsedSheet {
  headers: string[]
  rows: ParsedRow[]
  mapping: ColumnMapping
  hasHeader: boolean
}

const NUMERIC_HEAD = /^(serie|série|numero de serie|número de série|serial|modelo|model|ip|endereco ip|endereço ip|localizacao|localização|local|apelido|status|monitoramento|toner|toner \(%\)|% toner)$/i
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function guessColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = headers.findIndex(
      (header) => normalizeHeader(header) === normalizeHeader(candidate),
    )
    if (index >= 0) return index
  }
  for (const candidate of candidates) {
    const index = headers.findIndex((header) =>
      normalizeHeader(header).includes(normalizeHeader(candidate)),
    )
    if (index >= 0) return index
  }
  return -1
}

export function detectMappingAndHeader(
  rows: string[][],
): { mapping: ColumnMapping; hasHeader: boolean } {
  const looksHeader = (row: string[] | undefined) =>
    !!row &&
    row.filter((cell) => cell.trim() !== "" && !NUMERIC_HEAD.test(cell.trim()))
      .length === 0

  const firstIsHeader = looksHeader(rows[0])
  const headerRow = firstIsHeader ? rows[0] : undefined
  const probeRows = rows.slice(firstIsHeader ? 1 : 0, (firstIsHeader ? 1 : 0) + 12)

  let mapping: ColumnMapping

  if (headerRow) {
    mapping = {
      serial: guessColumn(headerRow, ["serie", "série", "serial", "numero de serie"]),
      model: guessColumn(headerRow, ["modelo", "model"]),
      ip: guessColumn(headerRow, ["ip", "endereco ip"]),
      location: guessColumn(headerRow, ["localizacao", "localização", "apelido", "local"]),
      status: guessColumn(headerRow, ["monitoramento", "status"]),
      toner: guessColumn(headerRow, ["toner", "% toner", "toner (%)"]),
    }
  } else {
    mapping = {
      serial: -1,
      model: -1,
      ip: -1,
      location: -1,
      status: -1,
      toner: -1,
    }
  }

  if (Object.values(mapping).some((index) => index < 0)) {
    // Inferência posicional pela forma dos dados.
    const depth = probeRows.reduce((max, row) => Math.max(max, row.length), 0)
    const scores = Array.from({ length: depth }, () => ({
      ip: 0,
      percent: 0,
      text: 0,
    }))
    for (const row of probeRows) {
      row.forEach((cell, index) => {
        const value = (cell ?? "").trim()
        if (value === "") return
        if (IP_PATTERN.test(value)) scores[index].ip += 1
        if (/^-?\d+(?:[.,]\d+)?%$/.test(value)) scores[index].percent += 1
        if (/[A-Za-zÀ-ÿ]{3,}/.test(value)) scores[index].text += 1
      })
    }

    const ipIndex = scores.reduce(
      (best, score, index) => (score.ip > scores[best].ip ? index : best),
      0,
    )
    const takenIp = scores[ipIndex]?.ip > 0 ? ipIndex : -1
    const percentIndex = scores.reduce(
      (best, score, index) =>
        index !== takenIp && score.percent > scores[best].percent ? index : best,
      takenIp === 0 ? 1 : 0,
    )

    if (mapping.ip < 0 && takenIp >= 0) mapping.ip = takenIp
    if (mapping.toner < 0 && percentIndex >= 0 && scores[percentIndex]?.percent > 0)
      mapping.toner = percentIndex

    if (mapping.serial < 0) mapping.serial = 0
    if (mapping.model < 0) mapping.model = 1
    if (mapping.location < 0) {
      const locationIndex = scores.findIndex(
        (score, index) =>
          index !== mapping.serial &&
          index !== mapping.model &&
          index !== mapping.ip &&
          index !== mapping.toner &&
          score.text >= 3,
      )
      mapping.location = locationIndex >= 0 ? locationIndex : 3
    }
    if (mapping.status < 0) {
      const statusIndex = scores.findIndex(
        (score, index) =>
          index !== mapping.serial &&
          index !== mapping.model &&
          index !== mapping.ip &&
          index !== mapping.toner &&
          index !== mapping.location &&
          score.text >= 2,
      )
      mapping.status = statusIndex >= 0 ? statusIndex : 4
    }
  }

  return { mapping, hasHeader: firstIsHeader }
}

export function parseWorkbookRows(rows: string[][]): ParsedSheet {
  const detected = detectMappingAndHeader(rows)
  const { mapping, hasHeader } = detected
  const dataRows = rows.slice(hasHeader ? 1 : 0)

  const parsedRows: ParsedRow[] = dataRows.map((raw, index) => {
    const errors: string[] = []
    const values = EXPECTED_COLUMNS.map((_, position) => raw[position] ?? "")

    const serial = (raw[mapping.serial] ?? "").trim()
    const model = (raw[mapping.model] ?? "").trim()
    const ip = (raw[mapping.ip] ?? "").trim()
    const location = (raw[mapping.location] ?? "").trim()
    const status = (raw[mapping.status] ?? "").trim()
    const tonerRaw = (raw[mapping.toner] ?? "").trim()

    if (serial === "") errors.push("Coluna A (Série) vazia.")
    if (model === "") errors.push("Coluna B (Modelo) vazia.")
    if (ip !== "" && ip !== "-" && ip !== "Sem IP" && !IP_PATTERN.test(ip))
      errors.push(`Coluna C (IP) inválida: "${ip}".`)
    if (location === "") errors.push("Coluna D (Localização) vazia.")
    if (status === "") errors.push("Coluna E (Status) vazia.")

    const toner = parsePercent(tonerRaw)
    if (tonerRaw !== "" && tonerRaw !== "-" && toner === null)
      errors.push(`Coluna F (Toner) inválida: "${tonerRaw}".`)

    const duplicated = dataRows
      .slice(0, index)
      .some((previous) => (previous[mapping.serial] ?? "").trim() === serial)
    if (serial !== "" && duplicated)
      errors.push(`Número de série duplicado no arquivo: "${serial}".`)

    return {
      rowNumber: index + (hasHeader ? 2 : 1),
      values,
      valid: errors.length === 0,
      errors,
    }
  })

  return { headers: EXPECTED_COLUMNS.map((column) => column.label), rows: parsedRows, mapping, hasHeader }
}

export function rowsToPrinters(
  sheet: ParsedSheet,
): {
  serial: string
  model: string
  ip: string
  location: string
  monitoring: string
  toner: number | null
  drums: number | null
  lastCheck: string
  defect: string
  defectSource: "auto" | "manual"
  sourceRow: number
}[] {
  const today = new Date().toISOString().slice(0, 10)
  return sheet.rows
    .filter((row) => row.valid)
    .map((row) => {
      const [serial, model, ip, location, status, tonerText] = row.values
      const toner = parsePercent(tonerText)
      const hasIp = IP_PATTERN.test(ip.trim())
      const monitoring =
        status.trim() === "" ? "Monitorada" : status.trim()
      const drums = null
      const defect = autoDefect({
        monitoring,
        toner,
        drums,
        ip: hasIp ? ip : "",
        lastCheck: today,
      })

      return {
        serial: serial.trim(),
        model: model.trim(),
        ip: hasIp ? ip.trim() : "",
        location: location.trim(),
        monitoring,
        toner,
        drums,
        lastCheck: today,
        defect,
        defectSource: "auto" as const,
        sourceRow: row.rowNumber,
      }
    })
}

export function ImportModal({
  open,
  onClose,
  onImport,
  onRestoreDemo,
  onHpsdDetected,
  hpsd,
  hpsdFileName,
  onOpenHpsd,
  onClearHpsd,
  busy,
}: {
  open: boolean
  onClose: () => void
  onImport: (sheet: ParsedSheet) => void
  onRestoreDemo: () => void
  onHpsdDetected: (reading: HpsdReading, fileName: string) => void
  hpsd: HpsdReading | null
  hpsdFileName: string
  onOpenHpsd: () => void
  onClearHpsd: () => void
  busy: boolean
}) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const validCount = sheet?.rows.filter((row) => row.valid).length ?? 0
  const invalidRows = sheet?.rows.filter((row) => !row.valid) ?? []

  const handleFile = async (file: File) => {
    setError("")
    try {
      const buffer = await file.arrayBuffer()
      const cleaned = readSpreadsheetRows(buffer)

      // A planilha do HPSD e a planilha baixada do próprio painel têm o mesmo
      // comportamento: a leitura é feita por coluna reconhecida (série, IP e
      // toner), sem exigir a ordem A–F, e só os percentuais são atualizados.
      const hpsdReading = readHpsdWorkbook(cleaned)
      const foundUsefulColumns =
        hpsdReading.layout.serialColumn >= 0 ||
        hpsdReading.layout.ipColumn >= 0
      const missingLayoutColumns =
        hpsdReading.layout.serialColumn < 0 || hpsdReading.layout.ipColumn < 0
      const parsedSheet = parseWorkbookRows(cleaned)
      const parsedValid = parsedSheet.rows.filter((row) => row.valid).length

      if (
        foundUsefulColumns &&
        hpsdReading.withToner > 0 &&
        (missingLayoutColumns ||
          parsedValid < hpsdReading.withToner ||
          hpsdReading.withToner >= parsedValid)
      ) {
        onHpsdDetected(hpsdReading, file.name)
        setSheet(null)
        setFileName(file.name)
        return
      }

      setSheet(parsedSheet)
      setFileName(file.name)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível ler o arquivo. Verifique se é um .xlsx, .xls ou .csv válido.",
      )
      setSheet(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/45 p-3 backdrop-blur-sm sm:p-6">
      <Card className="my-4 w-full max-w-4xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
              <FileSpreadsheet className="size-4 text-brand" />
              Atualização pela planilha
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Envie a planilha baixada do painel (ou a do HPSD): o sistema acha
              sozinho as colunas de Série, IP e Toner e atualiza só os
              percentuais, sem apagar a frota. O modelo A Série, B Modelo, C IP,
              D Apelido, E Status, F Toner (%) substitui a frota inteira.
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
                event.target.value = ""
              }}
            />
            <Button
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Selecionar arquivo
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={onRestoreDemo}
              disabled={busy}
            >
              <Table2 className="size-3.5" />
              Recarregar base de demonstração
            </Button>
            <Button
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={downloadTemplate}
            >
              <Download className="size-3.5" />
              Baixar modelo
            </Button>
            {fileName ? (
              <span className="text-xs font-medium text-muted-foreground">
                {fileName}
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/8 px-3 py-2 text-xs font-medium text-critical">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          {hpsd ? (
            <HpsdCard
              reading={hpsd}
              fileName={hpsdFileName}
              busy={busy}
              onOpen={onOpenHpsd}
              onClear={onClearHpsd}
            />
          ) : null}

          {sheet ? (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
                <label className="flex items-center gap-2 font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={sheet.hasHeader}
                    onChange={(event) =>
                      setSheet({ ...sheet, hasHeader: event.target.checked })
                    }
                    className="size-3.5 accent-[var(--brand)]"
                  />
                  Primeira linha é cabeçalho
                </label>
                <span className="hidden h-4 w-px bg-border sm:block" />
                <span className="flex items-center gap-1.5 font-semibold text-ok">
                  <CheckCircle2 className="size-3.5" />
                  {validCount} linhas válidas
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-semibold",
                    invalidRows.length > 0 ? "text-critical" : "text-muted-foreground",
                  )}
                >
                  <AlertTriangle className="size-3.5" />
                  {invalidRows.length} com aviso
                </span>
                <span className="font-medium text-muted-foreground">
                  Total: {sheet.rows.length} linhas
                </span>
              </div>

              <div className="rounded-lg border border-border">
                <p className="border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Mapeamento das colunas
                </p>
                <div className="flex flex-wrap gap-3 px-3 py-2.5">
                  {EXPECTED_COLUMNS.map((column) => {
                    const index = sheet.mapping[column.key as keyof ColumnMapping]
                    return (
                      <span
                        key={column.key}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                      >
                        <span className="font-bold text-brand">
                          {column.letter}
                        </span>
                        <span className="font-medium text-foreground">
                          {column.label}
                        </span>
                        <span className="text-muted-foreground">←</span>
                        <span
                          className={cn(
                            "font-semibold",
                            index >= 0 ? "text-foreground" : "text-critical",
                          )}
                        >
                          {index >= 0
                            ? `coluna ${String.fromCharCode(65 + index)}`
                            : "não encontrada"}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[760px] text-left text-[11px]">
                  <thead className="sticky top-0 bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-2 py-2">Linha</th>
                      {EXPECTED_COLUMNS.map((column) => (
                        <th key={column.key} className="px-2 py-2">
                          <span className="text-brand">{column.letter}</span>{" "}
                          {column.label}
                        </th>
                      ))}
                      <th className="px-2 py-2">Avisos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 200).map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={cn(
                          "border-t border-border/70",
                          row.valid ? "bg-card" : "bg-critical/6",
                        )}
                      >
                        <td className="px-2 py-1.5 font-mono font-semibold text-muted-foreground">
                          {row.rowNumber}
                        </td>
                        {row.values.map((value, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="max-w-[160px] truncate px-2 py-1.5 text-foreground"
                          >
                            {value || "—"}
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          {row.valid ? (
                            <span className="font-semibold text-ok">OK</span>
                          ) : (
                            <span className="font-medium text-critical">
                              {row.errors.join(" ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sheet.rows.length > 200 ? (
                <p className="text-[11px] text-muted-foreground">
                  Prévia das primeiras 200 linhas. Todas as {validCount} linhas
                  válidas serão importadas.
                </p>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <FileSpreadsheet className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">
                Nenhum arquivo selecionado
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Selecione um .xlsx, .xls ou .csv com a frota. Depois da leitura,
                confira o mapeamento e os avisos linha por linha antes de
                importar.
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <p className="text-[11px] text-muted-foreground">
            A planilha com os percentuais atualiza apenas o que mudou. O modelo
            A–F substitui a frota pelas linhas válidas do arquivo.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!sheet || validCount === 0 || busy}
              onClick={() => sheet && onImport(sheet)}
            >
              Importar {validCount > 0 ? `${validCount} linhas` : ""}
            </Button>
          </div>
        </footer>
      </Card>
    </div>
  )
}
