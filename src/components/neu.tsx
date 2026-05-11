import * as React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
};
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const NeuCard = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("neu-raised p-5", className)} {...props} />
  ),
);
NeuCard.displayName = "NeuCard";

export const NeuPanel = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("neu-pressed p-4", className)} {...props} />
  ),
);
NeuPanel.displayName = "NeuPanel";

export const NeuButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    const sizes = {
      sm: "h-10 px-4 text-sm",
      md: "h-12 px-6 text-sm",
      lg: "h-14 px-8 text-base",
      icon: "h-12 w-12 p-0",
    };
    const variants = {
      default: "neu-interactive text-foreground",
      primary:
        "neu-interactive gradient-primary !text-primary-foreground font-semibold",
      ghost: "rounded-2xl text-muted-foreground hover:text-foreground transition-colors",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium select-none",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0",
          sizes[size],
          variants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
NeuButton.displayName = "NeuButton";

export const NeuInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "neu-input h-12 w-full px-5 text-sm outline-none",
        className,
      )}
      {...props}
    />
  ),
);
NeuInput.displayName = "NeuInput";
