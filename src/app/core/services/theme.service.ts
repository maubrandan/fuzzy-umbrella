import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const STORAGE_KEY = 'qr-studio-theme';

function readStoredDarkPreference(): boolean | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark') {
      return true;
    }
    if (raw === 'light') {
      return false;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

function readSystemPrefersDark(): boolean {
  if (typeof matchMedia === 'undefined') {
    return false;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  /** `true` cuando el tema activo es oscuro (clase `.dark` en `html`). */
  private readonly dark = signal(this.resolveInitialDark());

  readonly isDark = this.dark.asReadonly();

  constructor() {
    effect(() => {
      const html = this.document.documentElement;
      if (this.dark()) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    });
  }

  toggle(): void {
    this.setDark(!this.dark());
  }

  setDark(value: boolean): void {
    this.dark.set(value);
    this.persist(value);
  }

  private resolveInitialDark(): boolean {
    const stored = readStoredDarkPreference();
    if (stored !== null) {
      return stored;
    }
    return readSystemPrefersDark();
  }

  private persist(isDark: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }
}
