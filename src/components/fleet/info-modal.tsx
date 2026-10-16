import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

import { Card } from "./ui"
import { cn } from "#/lib/utils"

/**
 * Janela sobreposta usada pelos tópicos do painel. Fecha com Esc, com o
 * botão no topo ou clicando fora do conteúdo.
 */
export function InfoModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  size = "lg",
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  size?: "md" | "lg" | "xl"
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const width =
    size === "md" ? "max-w-2xl" : size === "xl" ? "max-w-[1200px]" : "max-w-4xl"

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/45 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <Card
        className={cn("my-4 w-full", width)}
        // O clique dentro da janela não deve fechá-la.
      >
        <div onClick={(event) => event.stopPropagation()}>
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-foreground">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="px-4 py-4 sm:px-5">{children}</div>
        </div>
      </Card>
    </div>
  )
}
