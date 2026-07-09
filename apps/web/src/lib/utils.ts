import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Utility zum Zusammenführen von Tailwind-Klassen mit clsx */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
