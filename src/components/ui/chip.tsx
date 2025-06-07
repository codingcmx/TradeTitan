"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline";
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          variant === "default" && "bg-accent text-accent-foreground",
          variant === "outline" && "border border-input text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Chip.displayName = "Chip";

export { Chip };
