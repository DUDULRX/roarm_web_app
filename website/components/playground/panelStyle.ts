// Shared panel style for floating UI panels
// Usage: className={panelStyle}

export const panelStyle = [
  "bg-black/20",
  "backdrop-blur-sm",
  "rounded-lg",
  "border",
  "border-white/40",
  "shadow-[inset_0_1px_0px_rgba(255,255,255,0.4),0_0_9px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.15)]",
  "p-4",
  "text-white",
  "relative",
  "before:absolute",
  "before:inset-0",
  "before:rounded-lg",
  "before:bg-gradient-to-br",
  "before:from-white/15",
  "before:via-transparent",
  "before:to-transparent",
  "before:opacity-70",
  "before:pointer-events-none",
  "after:absolute",
  "after:inset-0",
  "after:rounded-lg",
  "after:bg-gradient-to-tl",
  "after:from-white/30",
  "after:via-transparent",
  "after:to-transparent",
  "after:opacity-50",
  "after:pointer-events-none"
].join(" ");
