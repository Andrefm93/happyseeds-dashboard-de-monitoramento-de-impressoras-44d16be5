import * as XLSX from "xlsx"

import {
  formatDateBr,
  tonerBand,
  TONER_BAND_LABEL,
  type FleetPrinter,
} from "./fleet"
import { STATUS_STYLE } from "#/components/fleet/ui"

export interface ReportDefinition {
  key: string
  /** Nome da aba, limitado a 31 caracteres pelo formato Excel. */
  sheetName: string
  title: string
  description: string
  printers: FleetPrinter[]
  tone: "ok" | "idle" | "critical" | "warn"
}

export function buildReports(printers: FleetPrinter[]): ReportDefinition[] {
  const monitored = printers.filter((printer) => printer.status === "Monitorada")
  const outOfMonitoring = printers.filter(
    (printer) => printer.status !== "Monitorada",
  )
  const critical = printers
    .filter(
      (printer) => printer.toner !== null && printer.toner > 0 && printer.toner <= 20,
    )
    .sort((a, b) => (a.toner ?? 0) - (b.toner ?? 0))
  const zeroed = printers.filter((printer) => printer.toner === 0)

  return [
    {
      key: "monitoramento",
      sheetName: "Em Monitoramento",
      title: "Impressoras em Monitoramento",
      description: "Equipamentos monitorados com leitura válida.",
      printers: monitored,
      tone: "ok",
    },
    {
      key: "fora",
      sheetName: "Fora de Monitoramento",
      title: "Impressoras Fora de Monitoramento",
      description: "Equipamentos sem leitura, BKP ou não monitorados.",
      printers: outOfMonitoring,
      tone: "idle",
    },
    {
      key: "criticos",
      sheetName: "Toners Críticos",
      title: "Toners Críticos",
      description: "Toners entre 1% e 20% — programar troca.",
      printers: critical,
      tone: "warn",
    },
    {
      key: "zerados",
      sheetName: "Toners Zerados",
      title: "Toners Zerados",
      description: "Toners em 0% — substituição imediata.",
      printers: zeroed,
      tone: "critical",
    },
  ]
}

const HEADERS = [
  "Série",
  "Modelo",
  "IP",
  "Localização",
  "Status",
  "Monitoramento (origem)",
  "Toner (%)",
  "Unidade de imagem (%)",
  "Faixa de toner",
  "Última atualização",
  "Defeito encontrado",
  "Origem do defeito",
]

function sheetRows(printers: FleetPrinter[]): (string | number)[][] {
  return [
    HEADERS,
    ...printers.map((printer) => [
      printer.serial,
      printer.model,
      printer.ip || "—",
      printer.location || "—",
      printer.status,
      printer.monitoring,
      printer.toner === null ? "sem leitura" : printer.toner,
      printer.drums === null ? "—" : printer.drums,
      TONER_BAND_LABEL[tonerBand(printer.toner)],
      formatDateBr(printer.lastCheck),
      printer.defect || "—",
      printer.defectSource,
    ]),
  ]
}

function autoWidth(rows: (string | number)[][]): { wch: number }[] {
  const widths = HEADERS.map((header) => header.length + 2)
  for (const row of rows.slice(1)) {
    row.forEach((cell, index) => {
      const length = String(cell).length
      if (length > widths[index]) widths[index] = Math.min(length + 2, 52)
    })
  }
  return widths.map((wch) => ({ wch }))
}

export function exportReport(report: ReportDefinition): void {
  const rows = sheetRows(report.printers)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = autoWidth(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    report.sheetName.slice(0, 31),
  )
  XLSX.writeFile(workbook, `${slug(report.title)}.xlsx`)
}

export function exportAllReports(
  reports: ReportDefinition[],
  timestampIso: string,
): void {
  const workbook = XLSX.utils.book_new()

  const overview: (string | number)[][] = [
    ["Relatório", "Qtd. de impressoras", "Descrição"],
    ...reports.map((report) => [
      report.title,
      report.printers.length,
      report.description,
    ]),
    [],
    ["Gerado em", formatDateBr(timestampIso.slice(0, 10))],
  ]
  const overviewSheet = XLSX.utils.aoa_to_sheet(overview)
  overviewSheet["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 46 }]
  XLSX.utils.book_append_sheet(workbook, overviewSheet, "Resumo")

  for (const report of reports) {
    const rows = sheetRows(report.printers)
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    worksheet["!cols"] = autoWidth(rows)
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      report.sheetName.slice(0, 31),
    )
  }

  XLSX.writeFile(workbook, "relatorios-impressoras.xlsx")
}

/** Modelo de planilha com as colunas esperadas na importação. */
export function downloadTemplate(): void {
  const rows: (string | number)[][] = [
    ["SERIE", "MODELO", "IP", "LOCALIZACAO", "STATUS", "TONER (%)"],
    ["07NYBJMM20000G", "X4220", "10.35.7.104", "FAB RIO BRANCO - NOVOS PROJETOS", "Monitorada", 59],
    ["BRBST3B0BF", "E50145DN", "10.35.7.87", "FAB RIO BRANCO - BALANCA SAIDA W9", "Monitorada", 66],
    ["ZDEJB07M425FWB", "M4020", "10.35.0.245", "FAB RIO BRANCO - CONTROLE QUALIDADE", "Monitorada", 0],
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 46 },
    { wch: 18 },
    { wch: 12 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Impressoras")
  XLSX.writeFile(workbook, "modelo-impressoras.xlsx")
}

/**
 * Planilha de trabalho da frota: série, modelo, IP, toner (%) e cilindro (%).
 *
 * É o mesmo arquivo que pode ser editado e reenviado em "Atualizar com planilha":
 * o sistema casa pela série (ou pelo IP) e atualiza apenas os percentuais.
 */
export function exportFleetSheet(
  printers: FleetPrinter[],
  timestampIso: string,
): void {
  const headers = [
    "SERIE",
    "MODELO",
    "IP",
    "TONER (%)",
    "CILINDRO (%)",
    "LOCALIZACAO",
    "STATUS",
    "ULTIMA VERIFICACAO",
    "DEFEITO ENCONTRADO",
  ]

  const rows: (string | number)[][] = [
    headers,
    ...printers.map((printer) => [
      printer.serial,
      printer.model,
      printer.ip || "",
      printer.toner === null ? "" : printer.toner,
      printer.drums === null ? "" : printer.drums,
      printer.location || "",
      printer.status,
      formatDateBr(printer.lastCheck),
      printer.defect || "",
    ]),
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 46 },
    { wch: 20 },
    { wch: 18 },
    { wch: 34 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Impressoras")
  XLSX.writeFile(
    workbook,
    `impressoras-ip-toner-${timestampIso.slice(0, 10)}.xlsx`,
  )
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export { STATUS_STYLE }
