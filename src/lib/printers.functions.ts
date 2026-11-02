import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
  applyReadings,
  countPrinters,
  importPrinters,
  listPrinters,
  loadSeedPrinters,
  reapplyAutoDefects,
  refreshMonitoring,
  updateDefectsInBulk,
  updatePrinterDefect,
  updatePrinterStatus,
  type ReadingUpdateResult,
} from "./printers.server"

export type { ReadingUpdateResult }

const printerInputSchema = z.object({
  serial: z.string().min(1),
  model: z.string().min(1),
  ip: z.string().default(""),
  location: z.string().default(""),
  monitoring: z.string().default("Monitorada"),
  toner: z.number().int().min(0).max(100).nullable(),
  drums: z.number().int().min(0).max(100).nullable(),
  lastCheck: z.string().default(""),
  defect: z.string().default(""),
  defectSource: z.enum(["auto", "manual"]).optional(),
  sourceRow: z.number().int().nullable().optional(),
})

export const fetchPrinters = createServerFn({ method: "GET" }).handler(() =>
  listPrinters(),
)

export const fetchPrinterCount = createServerFn({ method: "GET" }).handler(() =>
  countPrinters(),
)

export const importPrinterRows = createServerFn({ method: "POST" })
  .validator(z.object({ rows: z.array(printerInputSchema).max(5000) }))
  .handler(({ data }) => importPrinters(data.rows))

export const restoreDemoFleet = createServerFn({ method: "POST" }).handler(() =>
  loadSeedPrinters(),
)

export const refreshPrinterMonitoring = createServerFn({ method: "POST" })
  .validator(z.object({ checkedAt: z.string().optional() }))
  .handler(() => refreshMonitoring())

export const setPrinterDefect = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int(),
      defect: z.string(),
      source: z.enum(["auto", "manual"]),
    }),
  )
  .handler(({ data }) =>
    updatePrinterDefect(data.id, data.defect, data.source),
  )

/** Altera o status entre Monitorada e Fora de Monitoramento. */
export const setPrinterStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int(),
      status: z.enum(["Monitorada", "Fora de Monitoramento"]),
    }),
  )
  .handler(({ data }) => updatePrinterStatus(data.id, data.status))

export const setDefectsInBulk = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ids: z.array(z.number().int()).max(5000),
      defect: z.string(),
      source: z.enum(["auto", "manual"]),
    }),
  )
  .handler(({ data }) =>
    updateDefectsInBulk(data.ids, data.defect, data.source),
  )

export const runAutoDefects = createServerFn({ method: "POST" }).handler(() =>
  reapplyAutoDefects(),
)

const readingSchema = z.object({
  serial: z.string().optional(),
  ip: z.string().optional(),
  toner: z.number().int().min(0).max(100).nullable(),
})

/** Atualiza somente os percentuais, casando por série e depois por IP. */
export const updateTonerReadings = createServerFn({ method: "POST" })
  .validator(z.object({ entries: z.array(readingSchema).max(10000) }))
  .handler(({ data }) => applyReadings(data.entries))
