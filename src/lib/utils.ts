import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our type scale (globals.css) has custom names; without this, text-body would be read as a colour.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["title", "section", "body", "table", "meta"] }],
    },
  },
});

/** Joins class names and resolves conflicting Tailwind classes (the last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
