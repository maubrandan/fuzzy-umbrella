/**
 * Entrada de historial tras una exportación CSV exitosa (Print Merge / CorelDraw).
 */
export interface TrabajoRealizado {
  id: string;
  /** ISO 8601 (instante de la exportación). */
  fecha: string;
  puntoVenta: string;
  rangoInicio: number;
  rangoFin: number;
  padding: number;
  prefijo: string;
  cantidadRegistros: number;
}
