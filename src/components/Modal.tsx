import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";

interface Props {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/** Wspólna nakładka modalna: zamykanie Esc i kliknięciem w tło. */
export function Modal({ onClose, children, className = "max-w-4xl" }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-12"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`relative mx-auto w-full overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-white/10 ${className}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
