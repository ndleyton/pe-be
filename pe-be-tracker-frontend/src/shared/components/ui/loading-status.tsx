import * as React from "react"
import { cn } from "@/lib/utils"

export interface LoadingStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function LoadingStatus({ message, className, ...props }: LoadingStatusProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("sr-only", className)}
      {...props}
    >
      {message}
    </div>
  )
}
