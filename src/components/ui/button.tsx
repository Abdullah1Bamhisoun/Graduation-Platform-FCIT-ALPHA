import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg transition-colors disabled:pointer-events-none disabled:border-[var(--color-border)] disabled:text-[var(--color-text-600)] disabled:bg-[var(--color-surface-white)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-surface-white)] text-[var(--color-text-900)] font-bold border-[1.5px] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] active:border-[var(--color-border)] focus-visible:ring-gray-500/20",
        destructive:
          "bg-[var(--color-surface-white)] text-[#EF4444] font-bold border-[1.5px] border-[#EF4444] hover:bg-[var(--color-surface-alt)] active:text-[#DC2626] focus-visible:ring-red-500/20",
        outline:
          "bg-[var(--color-surface-white)] text-[var(--color-text-900)] font-bold border-[1.5px] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] active:border-[var(--color-border)] focus-visible:ring-gray-500/20",
        secondary:
          "bg-[var(--color-surface-white)] text-[var(--color-text-900)] font-bold border-[1.5px] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] active:border-[var(--color-border)] focus-visible:ring-gray-500/20",
        success:
          "bg-[var(--color-surface-white)] text-[var(--color-text-900)] font-bold border-[1.5px] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] active:border-[var(--color-border)] focus-visible:ring-gray-500/20",
        ghost:
          "bg-transparent hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] font-bold active:text-[var(--color-text-700)]",
        link: "bg-transparent text-[var(--color-text-900)] font-bold underline-offset-4 hover:underline active:text-[var(--color-text-700)]",
        primary: "bg-[var(--color-primary-600)] text-white font-bold border-[1.5px] border-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-700)] focus-visible:ring-[var(--color-primary-600)]/20",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8 text-sm",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
