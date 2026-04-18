/**
 * Parámetros de dominio para generar un lote de {@link RegistroImpresion}
 * (punto de venta, rango numérico inclusivo, padding y prefijo alfanumérico).
 */
export interface ConfiguracionGeneracionPrint {
  /** Código o etiqueta de punto de venta (opcional; se normaliza con trim). */
  puntoVenta: string;
  /** Extremo inferior del rango (inclusivo). Entero ≥ 0. */
  rangoInicio: number;
  /** Extremo superior del rango (inclusivo). Entero ≥ rangoInicio. */
  rangoFin: number;
  /** Ancho mínimo en dígitos del número local (padStart con '0'). Entero ≥ 1. */
  padding: number;
  /** Prefijo alfanumérico antes del número rellenado (se normaliza con trim). */
  prefijo: string;
}
