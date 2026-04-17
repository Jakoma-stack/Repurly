import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-primary text-white shadow-[0_16px_36px_rgba(99,102,241,0.28)] hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(99,102,241,0.34)]",
        secondary: "bg-secondary text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] hover:-translate-y-0.5",
        outline: "border border-slate-200 bg-white text-foreground shadow-sm hover:border-slate-300 hover:bg-slate-50",
        ghost: "text-foreground hover:bg-muted",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        lg: "h-12 px-6 text-base",
        sm: "h-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
