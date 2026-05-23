import { type ReactNode, type CSSProperties } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

type Variant = "up" | "fade" | "scale" | "left" | "right";

const initial: Record<Variant, string> = {
  up: "translate-y-6 opacity-0",
  fade: "opacity-0",
  scale: "scale-95 opacity-0",
  left: "-translate-x-6 opacity-0",
  right: "translate-x-6 opacity-0",
};

const final: Record<Variant, string> = {
  up: "translate-y-0 opacity-100",
  fade: "opacity-100",
  scale: "scale-100 opacity-100",
  left: "translate-x-0 opacity-100",
  right: "translate-x-0 opacity-100",
};

export function Reveal({
  as: Tag = "div",
  variant = "up",
  delay = 0,
  duration = 700,
  className,
  children,
}: {
  as?: any;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const style: CSSProperties = {
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform, opacity",
  };
  return (
    <Tag
      ref={ref}
      style={style}
      className={cn(
        "transition-[opacity,transform]",
        revealed ? final[variant] : initial[variant],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
