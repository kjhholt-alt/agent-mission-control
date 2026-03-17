"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

// Toast types
export type ToastVariant = "success" | "error" | "warning" | "info"

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, variant: ToastVariant, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

// Toast item component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const duration = toast.duration || 5000
  const [progress, setProgress] = useState(100)

  // Auto-dismiss timer
  useState(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)

      if (remaining === 0) {
        clearInterval(interval)
        onRemove(toast.id)
      }
    }, 50)

    return () => clearInterval(interval)
  })

  // Variant styles
  const variantStyles = {
    success: {
      bg: "bg-emerald-500/10 border-emerald-500/30",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      text: "text-emerald-100",
      progress: "bg-emerald-500",
    },
    error: {
      bg: "bg-red-500/10 border-red-500/30",
      icon: <AlertCircle className="w-4 h-4 text-red-400" />,
      text: "text-red-100",
      progress: "bg-red-500",
    },
    warning: {
      bg: "bg-amber-500/10 border-amber-500/30",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      text: "text-amber-100",
      progress: "bg-amber-500",
    },
    info: {
      bg: "bg-cyan-500/10 border-cyan-500/30",
      icon: <Info className="w-4 h-4 text-cyan-400" />,
      text: "text-cyan-100",
      progress: "bg-cyan-500",
    },
  }

  const style = variantStyles[toast.variant]

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-lg border backdrop-blur-sm",
        "min-w-[320px] max-w-[420px] shadow-2xl",
        style.bg
      )}
    >
      {/* Toast content */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium leading-snug", style.text)}>
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
          aria-label="Close toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <motion.div
          className={cn("h-full", style.progress)}
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: "linear" }}
        />
      </div>
    </motion.div>
  )
}

// Toast container
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-14 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={onRemove} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Toast provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, variant, duration }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// useToast hook
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return {
    success: (message: string, duration?: number) => context.addToast(message, "success", duration),
    error: (message: string, duration?: number) => context.addToast(message, "error", duration),
    warning: (message: string, duration?: number) => context.addToast(message, "warning", duration),
    info: (message: string, duration?: number) => context.addToast(message, "info", duration),
  }
}
