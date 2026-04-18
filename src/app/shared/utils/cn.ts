import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une utilidades Tailwind con `tailwind-merge` y argumentos condicionales con `clsx`.
 * En componentes: importar `cn` y usar en plantilla, p. ej.
 * `[class]="cn('flex gap-2', isActive() && 'bg-primary')"` o exponer un método que delegue en `cn`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
