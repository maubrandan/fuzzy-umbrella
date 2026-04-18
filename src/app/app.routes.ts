import { Routes } from '@angular/router';

import { GeneratorFormComponent } from './features/generator/generator-form.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'generator' },
  { path: 'generator', component: GeneratorFormComponent },
];
