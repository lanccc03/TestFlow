import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}
