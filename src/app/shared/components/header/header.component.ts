import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../../core/services/theme.service';
import { cn } from '../../utils/cn';

/** Versión mostrada en cabecera (alinear con releases). */
export const APP_VERSION_LABEL = 'v1.0.0';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly cn = cn;
  protected readonly version = APP_VERSION_LABEL;
}
