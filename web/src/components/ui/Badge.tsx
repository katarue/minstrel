type Variant = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";

interface BadgeProps {
  variant: Variant;
  children: React.ReactNode;
}

/* design_system.md 9-1 ジャンルバッジ カラーマッピング */
const variantStyles: Record<Variant, string> = {
  orchestra: "bg-bordeaux text-parchment",
  wind:      "bg-gold text-ink-heading",
  rock:      "bg-[#5A3A22] text-parchment",
  acoustic:  "bg-parchment-dark text-ink-body border border-ink-body/20",
  chamber:   "bg-info text-parchment",
  other:     "bg-ink-body text-parchment",
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-body rounded ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
