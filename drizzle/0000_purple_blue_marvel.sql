CREATE TABLE "printers" (
	"id" serial PRIMARY KEY NOT NULL,
	"serial_number" text NOT NULL,
	"model" text NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"monitoring" text DEFAULT 'Monitorada' NOT NULL,
	"toner_percent" integer,
	"toner_readings" text DEFAULT '' NOT NULL,
	"drum_percent" integer,
	"last_check" text DEFAULT '' NOT NULL,
	"defect" text DEFAULT '' NOT NULL,
	"defect_source" text DEFAULT 'auto' NOT NULL,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "printers_serial_idx" ON "printers" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "printers_model_idx" ON "printers" USING btree ("model");