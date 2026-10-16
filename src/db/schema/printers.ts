import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

/**
 * Frota de impressoras monitoradas.
 *
 * `tonerPercent` é nullable: `null` significa "sem leitura de toner"
 * (aparelho fora de monitoramento, sem IP ou que não reporta suprimento).
 */
export const printers = pgTable(
  "printers",
  {
    id: serial("id").primaryKey(),
    serialNumber: text("serial_number").notNull(),
    model: text("model").notNull(),
    ip: text("ip").notNull().default(""),
    location: text("location").notNull().default(""),
    /** Monitorada | Não Monitorada | BKP */
    monitoring: text("monitoring").notNull().default("Monitorada"),
    tonerPercent: integer("toner_percent"),
    /** Últimos percentuais de toner reportados (K, C, M, Y quando houver). */
    tonerReadings: text("toner_readings").notNull().default(""),
    /** Percentual do conjunto de imagem/unidade de imagem. */
    drumPercent: integer("drum_percent"),
    /** Data da última verificação no formato ISO (yyyy-mm-dd). */
    lastCheck: text("last_check").notNull().default(""),
    /** Defeito encontrado — texto livre. */
    defect: text("defect").notNull().default(""),
    /** auto | manual — como o defeito foi preenchido. */
    defectSource: text("defect_source").notNull().default("auto"),
    /** Linha de origem da planilha importada, para validação/depuração. */
    sourceRow: integer("source_row"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("printers_serial_idx").on(table.serialNumber),
    index("printers_model_idx").on(table.model),
  ],
)

export type PrinterRow = typeof printers.$inferSelect
export type NewPrinterRow = typeof printers.$inferInsert
