import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { merge } from 'rxjs';
import { startWith } from 'rxjs/operators';

import type { ConfiguracionGeneracionPrint } from '../../core/models/configuracion-generacion-print.model';
import type { TrabajoRealizado } from '../../core/models/trabajo-realizado.model';
import {
  MAX_REGISTROS_GENERACION,
  PrintGeneratorService,
  PREVISUALIZACION_MAX_FILAS,
  type ValoresMuestraDensidadQr,
} from '../../core/services/print-generator.service';
import { cn } from '../../shared/utils/cn';
import { HistoryListComponent } from './history-list.component';

function esEnteroNoNegativo(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined) {
    return null;
  }
  if (!Number.isInteger(v)) {
    return { entero: true };
  }
  if (v < 0) {
    return { min: true };
  }
  return null;
}

function esEntero(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined) {
    return null;
  }
  return Number.isInteger(v) ? null : { entero: true };
}

function rangoYLoteValidator(group: AbstractControl): ValidationErrors | null {
  const ini = group.get('rangoInicio');
  const fin = group.get('rangoFin');
  if (!ini || !fin) {
    return null;
  }
  const a = ini.value;
  const b = fin.value;
  if (a === null || b === null || a === undefined || b === undefined) {
    return null;
  }
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return null;
  }
  if (a > b) {
    return { rangoOrden: true };
  }
  const cantidad = b - a + 1;
  if (cantidad > MAX_REGISTROS_GENERACION) {
    return { loteMaximo: true };
  }
  return null;
}

function paddingVsRangoValidator(group: AbstractControl): ValidationErrors | null {
  const ini = group.get('rangoInicio');
  const fin = group.get('rangoFin');
  const padCtrl = group.get('padding');
  if (!ini || !fin || !padCtrl) {
    return null;
  }
  const a = ini.value;
  const b = fin.value;
  const p = padCtrl.value;
  if (
    a === null ||
    b === null ||
    p === null ||
    a === undefined ||
    b === undefined ||
    p === undefined
  ) {
    return null;
  }
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(p)) {
    return null;
  }
  if (a > b) {
    return null;
  }
  for (let n = a; n <= b; n++) {
    if (String(n).length > p) {
      return { paddingInsuficiente: true };
    }
  }
  return null;
}

@Component({
  selector: 'app-generator-form',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, HistoryListComponent],
  templateUrl: './generator-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratorFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly printGenerator = inject(PrintGeneratorService);
  readonly maxRegistrosGeneracion = MAX_REGISTROS_GENERACION;
  readonly previsualizacionMax = PREVISUALIZACION_MAX_FILAS;

  protected readonly cn = cn;

  readonly form = this.fb.group(
    {
      puntoVenta: this.fb.nonNullable.control('', {
        validators: [Validators.maxLength(120)],
      }),
      prefijo: this.fb.nonNullable.control('', {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(64)],
      }),
      rangoInicio: this.fb.control<number | null>(null, {
        validators: [Validators.required, Validators.min(0), esEnteroNoNegativo],
      }),
      rangoFin: this.fb.control<number | null>(null, {
        validators: [Validators.required, Validators.min(0), esEnteroNoNegativo],
      }),
      padding: this.fb.control<number | null>(null, {
        validators: [Validators.required, Validators.min(1), esEntero],
      }),
    },
    { validators: [rangoYLoteValidator, paddingVsRangoValidator] },
  );

  readonly formularioValido = signal(this.form.valid);

  constructor() {
    merge(this.form.statusChanges, this.form.valueChanges)
      .pipe(startWith(null), takeUntilDestroyed())
      .subscribe(() => {
        this.formularioValido.set(this.form.valid);
        this.sincronizarPrevisualizacion();
      });
  }

  protected showFieldError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  /** Rango inválido (inicio &gt; fin): resalta ambos campos numéricos del rango. */
  protected showRangoOrdenError(): boolean {
    return (
      !!this.form.errors?.['rangoOrden'] && (this.form.dirty || this.form.touched)
    );
  }

  protected showGroupError(key: string): boolean {
    return !!this.form.errors?.[key] && (this.form.dirty || this.form.touched);
  }

  protected inputClaseBase(invalido: boolean): string {
    return this.cn(
      'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors',
      'placeholder:text-slate-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-60',
      'dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100',
      invalido && 'border-red-500 focus-visible:ring-red-500 dark:border-red-500',
      !invalido && 'border-slate-200 dark:border-slate-600',
    );
  }

  protected mensajeCampo(name: string): string {
    const c = this.form.get(name);
    if (!c?.errors) {
      return '';
    }
    if (c.errors['required']) {
      return 'Este campo es obligatorio.';
    }
    if (c.errors['maxlength']) {
      return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (c.errors['minlength']) {
      return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    }
    if (c.errors['min']) {
      if (name === 'padding') {
        return 'El padding debe ser un entero mayor o igual a 1.';
      }
      return 'El valor debe ser mayor o igual a 0.';
    }
    if (c.errors['entero']) {
      return 'Debe ser un número entero.';
    }
    return 'Valor no válido.';
  }

  onGenerar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.printGenerator.generar({
      puntoVenta: v.puntoVenta.trim(),
      prefijo: v.prefijo.trim(),
      rangoInicio: v.rangoInicio!,
      rangoFin: v.rangoFin!,
      padding: v.padding!,
    });
  }

  onDescargarParaCorelDraw(): void {
    this.printGenerator.descargarCsvParaCorelDraw();
  }

  onRepetirDesdeHistorial(trabajo: TrabajoRealizado): void {
    this.form.patchValue(
      {
        puntoVenta: trabajo.puntoVenta,
        prefijo: trabajo.prefijo,
        rangoInicio: trabajo.rangoInicio,
        rangoFin: trabajo.rangoFin,
        padding: trabajo.padding,
      },
      { emitEvent: true },
    );
    this.formularioValido.set(this.form.valid);
    this.sincronizarPrevisualizacion();
    this.cdr.markForCheck();
  }

  private sincronizarPrevisualizacion(): void {
    const config = this.parseConfigParaDominio();
    this.printGenerator.actualizarPrevisualizacion(config, this.valoresMuestraDensidadQr());
  }

  private valoresMuestraDensidadQr(): ValoresMuestraDensidadQr {
    const v = this.form.getRawValue();
    return {
      puntoVenta: v.puntoVenta,
      prefijo: v.prefijo,
      rangoInicio: v.rangoInicio,
      padding: v.padding,
    };
  }

  /** Barra de color junto al prefijo: densidad del payload QR. */
  protected qrIndicadorBarraClase(): string {
    const nivel = this.printGenerator.qrStatus().nivel;
    return this.cn(
      'h-2 w-14 shrink-0 rounded-full transition-colors',
      nivel === 'seguro' && 'bg-emerald-500',
      nivel === 'advertencia' && 'bg-amber-400',
      nivel === 'peligro' && 'bg-red-500',
    );
  }

  protected qrIndicadorTextoClase(): string {
    const nivel = this.printGenerator.qrStatus().nivel;
    return this.cn(
      'rounded-md px-2 py-0.5 text-xs font-medium',
      nivel === 'seguro' &&
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      nivel === 'advertencia' &&
        'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
      nivel === 'peligro' && 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    );
  }

  protected qrIndicadorEtiqueta(): string {
    switch (this.printGenerator.qrStatus().nivel) {
      case 'seguro':
        return 'Seguro (ideal)';
      case 'advertencia':
        return 'Advertencia';
      case 'peligro':
        return 'Peligro';
    }
  }

  /** Construye configuración para el dominio si los valores son parseables (sin exigir `form.valid`). */
  private parseConfigParaDominio(): ConfiguracionGeneracionPrint | null {
    const v = this.form.getRawValue();
    const { rangoInicio: a, rangoFin: b, padding: p } = v;
    if (
      a === null ||
      b === null ||
      p === null ||
      a === undefined ||
      b === undefined ||
      p === undefined
    ) {
      return null;
    }
    if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(p)) {
      return null;
    }
    return {
      puntoVenta: v.puntoVenta.trim(),
      prefijo: v.prefijo.trim(),
      rangoInicio: a,
      rangoFin: b,
      padding: p,
    };
  }
}
