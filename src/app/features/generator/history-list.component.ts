import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, output } from '@angular/core';

import type { TrabajoRealizado } from '../../core/models/trabajo-realizado.model';
import { HistoryService } from '../../core/services/history.service';
import { cn } from '../../shared/utils/cn';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './history-list.component.html',
})
export class HistoryListComponent {
  private readonly history = inject(HistoryService);

  /** Emite los parámetros del trabajo para rellenar el formulario principal. */
  readonly repetirTrabajo = output<TrabajoRealizado>();

  protected readonly cn = cn;

  protected readonly filas = this.history.historial;

  onRepetir(trabajo: TrabajoRealizado): void {
    this.repetirTrabajo.emit(trabajo);
  }

  onEliminarHistorial(): void {
    if (this.filas().length === 0) {
      return;
    }
    const ok = globalThis.confirm('¿Vaciar todo el historial de trabajos?');
    if (ok) {
      this.history.limpiar();
    }
  }
}
