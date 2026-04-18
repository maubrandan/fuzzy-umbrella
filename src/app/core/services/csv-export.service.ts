import { Injectable } from '@angular/core';

import type { RegistroImpresion } from '../models/registro-impresion.model';

/** Opciones de exportación CSV (Print Merge / Excel en Windows). */
export interface CsvExportToFileOptions {
  /** Delimitador de campo; por defecto `;` (regionalización típica AR). */
  delimiter?: ',' | ';';
  /** Nombre del archivo descargado; por defecto incluye fecha local. */
  filename?: string;
}

const LINE = '\r\n' as const;
const BOM = '\uFEFF';

const COLUMNAS: (keyof RegistroImpresion)[] = [
  'id',
  'prefijoPuntoVenta',
  'codigoLocal',
  'payloadQr',
  'descripcion',
  'cantidad',
  'estado',
  'creadoEn',
  'actualizadoEn',
  'notas',
];

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  /**
   * Genera CSV con BOM UTF-8, CRLF y delimitador configurable, y dispara la descarga en el navegador.
   */
  exportToCsv(registros: RegistroImpresion[], options?: CsvExportToFileOptions): void {
    const delimiter = options?.delimiter ?? ';';
    const body = this.serializarCsv(registros, delimiter);
    const content = BOM + body;
    const filename = options?.filename ?? this.nombreArchivoPorDefecto();

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private nombreArchivoPorDefecto(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
      d.getMinutes(),
    )}${pad(d.getSeconds())}`;
    return `registros-imprenta_${stamp}.csv`;
  }

  private serializarCsv(registros: RegistroImpresion[], delimiter: ',' | ';'): string {
    const header = COLUMNAS.map((c) => this.escapeCampo(c, delimiter)).join(delimiter);
    const filas = registros.map((row) =>
      COLUMNAS.map((key) => this.escapeCampo(this.valorCelda(row[key]), delimiter)).join(delimiter),
    );
    return [header, ...filas].join(LINE);
  }

  private valorCelda(value: RegistroImpresion[keyof RegistroImpresion]): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return String(value);
  }

  /** RFC 4180: comillas si hay delimitador, comillas o saltos de línea. */
  private escapeCampo(raw: string, delimiter: string): string {
    const needsQuotes =
      raw.includes(delimiter) || raw.includes('"') || raw.includes('\r') || raw.includes('\n');
    if (!needsQuotes) {
      return raw;
    }
    return `"${raw.replace(/"/g, '""')}"`;
  }
}
