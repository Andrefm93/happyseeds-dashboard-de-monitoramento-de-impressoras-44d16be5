import { asc, eq, sql } from "drizzle-orm"

import { withDatabase } from "#/db/index"
import { printers } from "#/db/schema/printers"
import { FLEET_SEED, type FleetSeedRow } from "#/lib/fleet-seed"
import {
  autoDefect,
  deriveStatus,
  type FleetPrinter,
} from "#/lib/fleet"

export interface PrinterInput {
  serial: string
  model: string
  ip: string
  location: string
  monitoring: string
  toner: number | null
  drums: number | null
  lastCheck: string
  defect: string
  defectSource?: "auto" | "manual"
  sourceRow?: number | null
}

function toFleetPrinter(row: typeof printers.$inferSelect): FleetPrinter {
  const defect = row.defect ?? ""
  return {
    id: row.id,
    serial: row.serialNumber,
    model: row.model,
    ip: row.ip ?? "",
    location: row.location ?? "",
    monitoring: row.monitoring,
    status: deriveStatus(row.monitoring, row.tonerPercent, row.drumPercent, defect),
    toner: row.tonerPercent,
    drums: row.drumPercent,
    lastCheck: row.lastCheck ?? "",
    defect,
    defectSource: row.defectSource === "manual" ? "manual" : "auto",
    sourceRow: row.sourceRow ?? null,
  }
}

export async function listPrinters(): Promise<FleetPrinter[]> {
  return withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(printers)
      .orderBy(asc(printers.model), asc(printers.serialNumber))
    return rows.map(toFleetPrinter)
  })
}

export async function countPrinters(): Promise<number> {
  return withDatabase(async (db) => {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(printers)
    return row?.total ?? 0
  })
}

async function replaceAll(
  db: Parameters<Parameters<typeof withDatabase>[0]>[0],
  rows: PrinterInput[],
): Promise<number> {
  await db.delete(printers)
  if (rows.length === 0) return 0

  const values = rows.map((row) => ({
    serialNumber: row.serial,
    model: row.model,
    ip: row.ip,
    location: row.location,
    monitoring: row.monitoring,
    tonerPercent: row.toner,
    drumPercent: row.drums,
    lastCheck: row.lastCheck,
    defect: row.defect,
    defectSource: row.defectSource ?? "auto",
    sourceRow: row.sourceRow ?? null,
  }))

  const chunkSize = 200
  for (let index = 0; index < values.length; index += chunkSize) {
    await db.insert(printers).values(values.slice(index, index + chunkSize))
  }
  return rows.length
}

export async function importPrinters(rows: PrinterInput[]): Promise<number> {
  return withDatabase((db) => replaceAll(db, rows))
}

export async function loadSeedPrinters(): Promise<number> {
  const rows: PrinterInput[] = FLEET_SEED.map((row: FleetSeedRow, index) => {
    const defect = row.defect.trim()
    return {
      serial: row.serial,
      model: row.model,
      ip: row.ip,
      location: row.location,
      monitoring: row.monitoring,
      toner: row.toner,
      drums: row.drums,
      lastCheck: row.lastCheck,
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
      sourceRow: index + 1,
    }
  })
  return withDatabase((db) => replaceAll(db, rows))
}

/**
 * Reprocessa a frota: recalcula status e defeitos automáticos, e renova a
 * data da última verificação de todos os equipamentos com leitura.
 */
export async function refreshMonitoring(): Promise<{
  updated: number
  checkedAt: string
}> {
  const today = new Date().toISOString().slice(0, 10)

  return withDatabase(async (db) => {
    const rows = await db.select().from(printers)
    let updated = 0

    for (const row of rows) {
      const keepsManualDefect = row.defectSource === "manual" && row.defect.trim() !== ""
      const hasReading = row.tonerPercent !== null || row.drumPercent !== null

      const nextDefect = keepsManualDefect
        ? row.defect
        : autoDefect({
            monitoring: row.monitoring,
            toner: row.tonerPercent,
            drums: row.drumPercent,
            ip: row.ip ?? "",
            lastCheck: row.lastCheck ?? "",
          })

      const nextCheck = hasReading ? today : (row.lastCheck ?? "")

      await db
        .update(printers)
        .set({
          defect: nextDefect,
          defectSource: keepsManualDefect ? "manual" : "auto",
          lastCheck: nextCheck,
          updatedAt: new Date(),
        })
        .where(eq(printers.id, row.id))

      updated += 1
    }

    return { updated, checkedAt: new Date().toISOString() }
  })
}

export async function updatePrinterDefect(
  id: number,
  defect: string,
  source: "auto" | "manual",
): Promise<number> {
  return withDatabase(async (db) => {
    const result = await db
      .update(printers)
      .set({ defect, defectSource: source, updatedAt: new Date() })
      .where(eq(printers.id, id))
      .returning({ id: printers.id })
    return result.length
  })
}

export async function updateDefectsInBulk(
  ids: number[],
  defect: string,
  source: "auto" | "manual",
): Promise<number> {
  if (ids.length === 0) return 0
  return withDatabase(async (db) => {
    const result = await db
      .update(printers)
      .set({ defect, defectSource: source, updatedAt: new Date() })
      .where(sql`${printers.id} in ${ids}`)
      .returning({ id: printers.id })
    return result.length
  })
}

export async function reapplyAutoDefects(): Promise<number> {
  return withDatabase(async (db) => {
    const rows = await db.select().from(printers)
    let updated = 0
    for (const row of rows) {
      const next = autoDefect({
        monitoring: row.monitoring,
        toner: row.tonerPercent,
        drums: row.drumPercent,
        ip: row.ip ?? "",
        lastCheck: row.lastCheck ?? "",
      })
      if (next !== row.defect || row.defectSource !== "auto") {
        await db
          .update(printers)
          .set({ defect: next, defectSource: "auto", updatedAt: new Date() })
          .where(eq(printers.id, row.id))
        updated += 1
      }
    }
    return updated
  })
}

/* ---------------------------------------------------------------- */
/* Atualização de leituras por número de série / IP                  */
/* ---------------------------------------------------------------- */

export interface ReadingInput {
  serial?: string
  ip?: string
  toner: number | null
}

export interface ReadingUpdateResult {
  /** Equipamentos localizados no painel. */
  matched: number
  /** Percentuais efetivamente alterados. */
  updated: number
  /** Linhas com série que não existe na frota. */
  notFound: number
  /** Linhas sem série e cujo IP também não foi encontrado. */
  unmatchedIp: number
  /** Linhas sem leitura de toner no arquivo. */
  withoutToner: number
  /** Linhas do arquivo repetidas. */
  ignored: number
  /** Linhas com série e IP apontando para equipamentos diferentes. */
  conflicts: number
}

function normKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Atualiza apenas os percentuais de toner, casando cada linha pela série e,
 * quando não houver série, pelo IP. Nada é apagado: a frota continua igual.
 */
export async function applyReadings(
  entries: ReadingInput[],
): Promise<ReadingUpdateResult> {
  const result: ReadingUpdateResult = {
    matched: 0,
    updated: 0,
    notFound: 0,
    unmatchedIp: 0,
    withoutToner: 0,
    ignored: 0,
    conflicts: 0,
  }

  const keyed = entries.filter(
    (entry) => (entry.serial ?? "").trim() !== "" || (entry.ip ?? "").trim() !== "",
  )
  result.ignored = entries.length - keyed.length
  if (keyed.length === 0) return result

  return withDatabase(async (db) => {
    const rows = await db.select().from(printers)
    const bySerial = new Map<string, (typeof rows)[number]>()
    const byIp = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      bySerial.set(normKey(row.serialNumber), row)
      const ip = (row.ip ?? "").trim()
      if (ip !== "") byIp.set(ip, row)
    }

    const today = new Date().toISOString().slice(0, 10)
    const touched = new Map<number, number | null>()

    for (const entry of keyed) {
      const serial = (entry.serial ?? "").trim()
      const ip = (entry.ip ?? "").trim()

      const bySerialRow = serial === "" ? undefined : bySerial.get(normKey(serial))
      const byIpRow = ip === "" ? undefined : byIp.get(ip)

      if (serial !== "" && bypassConflict(bySerialRow, byIpRow, serial, ip)) {
        result.conflicts += 1
        continue
      }

      const row = bySerialRow ?? byIpRow
      if (!row) {
        if (serial !== "") result.notFound += 1
        else result.unmatchedIp += 1
        continue
      }

      result.matched += 1
      if (entry.toner === null) {
        result.withoutToner += 1
        continue
      }
      touched.set(row.id, entry.toner)
    }

    for (const row of rows) {
      if (!touched.has(row.id)) continue
      const nextToner = touched.get(row.id) ?? null
      const monitoring = row.monitoring
      const drums = row.drumPercent

      const keepsManual = row.defectSource === "manual" && row.defect.trim() !== ""
      const defect = keepsManual
        ? row.defect
        : autoDefect({
            monitoring,
            toner: nextToner,
            drums,
            ip: row.ip ?? "",
            lastCheck: today,
          })

      await db
        .update(printers)
        .set({
          tonerPercent: nextToner,
          defect,
          defectSource: keepsManual ? "manual" : "auto",
          lastCheck: today,
          updatedAt: new Date(),
        })
        .where(eq(printers.id, row.id))

      if (row.tonerPercent !== nextToner) result.updated += 1
    }

    return result
  })
}

/** Série e IP apontando para equipamentos diferentes: dado inconsistente. */
function bypassConflict(
  bySerialRow: { id: number } | undefined,
  byIpRow: { id: number } | undefined,
  serial: string,
  ip: string,
): boolean {
  return (
    serial !== "" &&
    ip !== "" &&
    bySerialRow !== undefined &&
    byIpRow !== undefined &&
    bySerialRow.id !== byIpRow.id
  )
}
