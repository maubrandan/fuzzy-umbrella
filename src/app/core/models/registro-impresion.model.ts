/**
 * Estado del ciclo de vida de un registro de impresión (taller / QR / Corel).
 */
export type EstadoRegistroImpresion =
  | 'pendiente'
  | 'en_cola'
  | 'impreso'
  | 'anulado';

/**
 * Registro de dominio para un trabajo de impresión alineado con QR y Print Merge.
 * Fechas en ISO 8601 para serialización y APIs.
 */
export interface RegistroImpresion {
  id: string;
  prefijoPuntoVenta?: string;
  codigoLocal: string;
  payloadQr: string;
  descripcion?: string;
  cantidad: number;
  estado: EstadoRegistroImpresion;
  creadoEn: string;
  actualizadoEn?: string;
  notas?: string;
}
