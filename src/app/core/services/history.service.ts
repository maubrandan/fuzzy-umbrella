import { effect, Injectable, signal } from '@angular/core';

import type { TrabajoRealizado } from '../models/trabajo-realizado.model';

const STORAGE_KEY = 'corel-qr-generator.printHistorial.v1';

/** Máximo de entradas persistidas (evita crecer sin límite en LocalStorage). */
const MAX_ENTRADAS = 100;

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly _historial = signal<TrabajoRealizado[]>([]);

  /** Últimos trabajos primero. */
  readonly historial = this._historial.asReadonly();

  constructor() {
    this._historial.set(this.leerAlmacenamiento());
    effect(() => {
      const filas = this._historial();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filas));
      } catch {
        // Cuota o modo privado: el historial sigue en memoria de sesión.
      }
    });
  }

  /** Añade un trabajo al inicio del historial y persiste. */
  registrar(trabajo: Omit<TrabajoRealizado, 'id'> & { id?: string }): void {
    const id = trabajo.id ?? crypto.randomUUID();
    const entrada: TrabajoRealizado = { ...trabajo, id };
    this._historial.update((prev) => [entrada, ...prev].slice(0, MAX_ENTRADAS));
  }

  /** Vacía todo el historial (y LocalStorage en el próximo effect). */
  limpiar(): void {
    this._historial.set([]);
  }

  private leerAlmacenamiento(): TrabajoRealizado[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(this.esTrabajoValido);
    } catch {
      return [];
    }
  }

  private esTrabajoValido(value: unknown): value is TrabajoRealizado {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const t = value as Record<string, unknown>;
    return (
      typeof t['id'] === 'string' &&
      typeof t['fecha'] === 'string' &&
      typeof t['puntoVenta'] === 'string' &&
      typeof t['rangoInicio'] === 'number' &&
      typeof t['rangoFin'] === 'number' &&
      typeof t['padding'] === 'number' &&
      typeof t['prefijo'] === 'string' &&
      typeof t['cantidadRegistros'] === 'number'
    );
  }
}
