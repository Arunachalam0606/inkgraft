import { motion } from 'motion/react';

// Page outline with an ink stroke being "grafted" in; the stroke draws itself on mount.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--fg)" />
      <path d="M10 7.5h8.5l4.5 4.5v12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1z" fill="none" stroke="var(--bg)" strokeWidth="1.8" />
      <motion.path
        d="M12 20.5c1.6-4.6 3.4 1.6 5-2.6s2.6 1.2 3.6-.6"
        fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight text-[17px]">
      <LogoMark />
      <span>ink<span className="font-serif italic font-normal text-[19px] text-ink">graft</span></span>
    </span>
  );
}
