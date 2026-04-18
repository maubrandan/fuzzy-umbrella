import { computed, inject, Injectable, signal } from '@angular/core';

import type { ConfiguracionGeneracionPrint } from '../models/configuracion-generacion-print.model';
import type { RegistroImpresion } from '../models/registro-impresion.model';
import { CsvExportService } from './csv-export.service';
import { HistoryService } from './history.service';

/** Límite de filas por generación (rendimiento / memoria en el navegador). */
export const MAX_REGISTROS_GENERACION = 10_000;

/** Filas mostradas en vista previa en vivo. */
export const PREVISUALIZACION_MAX_FILAS = 5;

export type EstadoGeneracionPrint = 'inicial' | 'generando' | 'listo' | 'error';

/** Niveles de densidad del contenido del QR según longitud del payload. */
export type QrDensidadNivel = 'seguro' | 'advertencia' | 'peligro';

export interface QrStatus {
  nivel: QrDensidadNivel;
  longitud: number;
}

/**
 * Valores del formulario para estimar la longitud del payload QR en vivo
 * (pueden estar incompletos; se usa rango inicio y padding cuando son válidos).
 */
export interface ValoresMuestraDensidadQr {
  puntoVenta: string;
  prefijo: string;
  rangoInicio: number | null;
  padding: number | null;
}

@Injectable({ providedIn: 'root' })
export class PrintGeneratorService {
  private readonly csvExport = inject(CsvExportService);
  private readonly history = inject(HistoryService);

  private readonly _registros = signal<RegistroImpresion[]>([]);
  private readonly _previsualizacion = signal<RegistroImpresion[]>([]);
  private readonly _errorValidacion = signal<string | null>(null);
  private readonly _estado = signal<EstadoGeneracionPrint>('inicial');
  /** Configuración del último lote generado correctamente (alineada con {@link _registros}). */
  private readonly _ultimaConfiguracion = signal<ConfiguracionGeneracionPrint | null>(null);
  /** Cadena representativa del payload QR para análisis de densidad (reactiva al formulario). */
  private readonly _payloadQrMuestra = signal('');

  /** Último lote generado correctamente (vacío tras error o antes de la primera generación). */
  readonly registros = this._registros.asReadonly();
  /** Hasta {@link PREVISUALIZACION_MAX_FILAS} filas válidas según dominio, sin mutar el lote final. */
  readonly previsualizacion = this._previsualizacion.asReadonly();
  /** Mensaje de dominio si la última llamada falló la validación; `null` si no hubo error. */
  readonly errorValidacion = this._errorValidacion.asReadonly();
  /** Ciclo de vida de la última operación de generación. */
  readonly estado = this._estado.asReadonly();

  readonly conteoRegistros = computed(() => this._registros().length);
  readonly hayRegistros = computed(() => this._registros().length > 0);

  /**
   * Estado de densidad del QR según la longitud del {@link _payloadQrMuestra}:
   * seguro &lt; 25, advertencia 25–60, peligro &gt; 60.
   */
  readonly qrStatus = computed((): QrStatus => {
    const longitud = this._payloadQrMuestra().length;
    if (longitud < 25) {
      return { nivel: 'seguro', longitud };
    }
    if (longitud <= 60) {
      return { nivel: 'advertencia', longitud };
    }
    return { nivel: 'peligro', longitud };
  });

  /**
   * Actualiza la vista previa según la configuración (p. ej. mientras el usuario edita el formulario).
   * No modifica {@link registros} ni {@link estado} de la generación definitiva.
   */
  actualizarPrevisualizacion(
    config: ConfiguracionGeneracionPrint | null,
    muestraDensidad: ValoresMuestraDensidadQr,
  ): void {
    this._payloadQrMuestra.set(this.construirPayloadQrMuestra(muestraDensidad));
    if (!config) {
      this._previsualizacion.set([]);
      return;
    }
    if (this.validarConfiguracion(config) !== null) {
      this._previsualizacion.set([]);
      return;
    }
    this._previsualizacion.set(this.construirRegistrosLimitados(config, PREVISUALIZACION_MAX_FILAS));
  }

  /**
   * Valida la configuración, actualiza signals de estado y devuelve el array generado.
   * Rango **inclusivo**: cantidad = rangoFin - rangoInicio + 1.
   */
  generar(config: ConfiguracionGeneracionPrint): RegistroImpresion[] {
    this._estado.set('generando');
    this._errorValidacion.set(null);

    const mensaje = this.validarConfiguracion(config);
    if (mensaje !== null) {
      this._registros.set([]);
      this._ultimaConfiguracion.set(null);
      this._errorValidacion.set(mensaje);
      this._estado.set('error');
      return [];
    }

    const registros = this.construirRegistros(config);
    this._registros.set(registros);
    this._ultimaConfiguracion.set(config);
    this._estado.set('listo');
    return registros;
  }

  /**
   * Exporta el lote actual a CSV (CorelDraw) y registra el trabajo en el historial si la exportación concluye.
   */
  descargarCsvParaCorelDraw(): void {
    const registros = this._registros();
    const config = this._ultimaConfiguracion();
    if (registros.length === 0 || !config) {
      return;
    }
    this.csvExport.exportToCsv(registros);
    this.history.registrar({
      fecha: new Date().toISOString(),
      puntoVenta: config.puntoVenta,
      rangoInicio: config.rangoInicio,
      rangoFin: config.rangoFin,
      padding: config.padding,
      prefijo: config.prefijo,
      cantidadRegistros: registros.length,
    });
  }

  /** Limpia registros, previsualización, error y vuelve el estado a inicial. */
  reiniciar(): void {
    this._registros.set([]);
    this._previsualizacion.set([]);
    this._ultimaConfiguracion.set(null);
    this._errorValidacion.set(null);
    this._estado.set('inicial');
    this._payloadQrMuestra.set('');
  }

  /**
   * Replica la lógica de {@link construirFila} con tolerancia a campos incompletos:
   * si el padding aún no es válido, solo se usa prefijo (y PV) para la longitud aproximada.
   */
  private construirPayloadQrMuestra(v: ValoresMuestraDensidadQr): string {
    const pv = v.puntoVenta.trim();
    const prefijo = v.prefijo.trim();
    const p = v.padding;
    const n =
      typeof v.rangoInicio === 'number' && Number.isInteger(v.rangoInicio) && v.rangoInicio >= 0
        ? v.rangoInicio
        : 0;
    let codigoLocal = prefijo;
    if (typeof p === 'number' && Number.isInteger(p) && p >= 1) {
      codigoLocal = `${prefijo}${n.toString().padStart(p, '0')}`;
    }
    return pv.length > 0 ? `${pv}${codigoLocal}` : codigoLocal;
  }

  private validarConfiguracion(c: ConfiguracionGeneracionPrint): string | null {
    const { rangoInicio: a, rangoFin: b, padding: p } = c;

    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      return 'Rango inicio y fin deben ser enteros.';
    }
    if (a < 0 || b < 0) {
      return 'Rango inicio y fin deben ser mayores o iguales a cero.';
    }
    if (a > b) {
      return 'El rango inicio no puede ser mayor que el rango fin.';
    }

    const cantidad = b - a + 1;
    if (cantidad > MAX_REGISTROS_GENERACION) {
      return `El lote supera el máximo permitido (${MAX_REGISTROS_GENERACION.toLocaleString('es-ES')} registros).`;
    }

    if (!Number.isInteger(p) || p < 1) {
      return 'El padding debe ser un entero mayor o igual a 1.';
    }

    for (let n = a; n <= b; n++) {
      const digitos = String(n).length;
      if (digitos > p) {
        return `El padding (${p}) es insuficiente para el número ${n} (${digitos} dígitos).`;
      }
    }

    return null;
  }

  private construirFila(
    n: number,
    c: ConfiguracionGeneracionPrint,
    creadoEn: string,
    id: string,
  ): RegistroImpresion {
    const pv = c.puntoVenta.trim();
    const prefijo = c.prefijo.trim();
    const pad = c.padding;
    const parteNumerica = n.toString().padStart(pad, '0');
    const codigoLocal = `${prefijo}${parteNumerica}`;
    const payloadQr = pv.length > 0 ? `${pv}${codigoLocal}` : codigoLocal;

    return {
      id,
      prefijoPuntoVenta: pv.length > 0 ? pv : undefined,
      codigoLocal,
      payloadQr,
      cantidad: 1,
      estado: 'pendiente',
      creadoEn,
    };
  }

  private construirRegistrosLimitados(
    c: ConfiguracionGeneracionPrint,
    limite: number,
  ): RegistroImpresion[] {
    const a = c.rangoInicio;
    const b = c.rangoFin;
    const fin = Math.min(b, a + limite - 1);
    const ahora = new Date().toISOString();
    const out: RegistroImpresion[] = [];
    for (let n = a; n <= fin; n++) {
      out.push(this.construirFila(n, c, ahora, crypto.randomUUID()));
    }
    return out;
  }

  private construirRegistros(c: ConfiguracionGeneracionPrint): RegistroImpresion[] {
    const a = c.rangoInicio;
    const b = c.rangoFin;
    const ahora = new Date().toISOString();
    const out: RegistroImpresion[] = [];
    for (let n = a; n <= b; n++) {
      out.push(this.construirFila(n, c, ahora, crypto.randomUUID()));
    }
    return out;
  }
}
