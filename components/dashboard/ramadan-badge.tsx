"use client";

import { motion } from "framer-motion";

/**
 * Animated Ramadan recommendation badge for recipe cards.
 * Features an animated gradient that blends Ramadan gold/purple tones with the app's lime green.
 * Designed to be minimal, special, and on-brand.
 */
export function RamadanBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
      className="ramadan-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase select-none"
    >
      <span className="ramadan-badge-icon">☪</span>
      <span>Ramadan Pick</span>
    </motion.span>
  );
}
