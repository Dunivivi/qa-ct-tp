import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadChildren: () => import('./features/library/library.routes') },
  { path: 'learn', loadChildren: () => import('./features/learn/learn.routes') },
  { path: 'browse', loadChildren: () => import('./features/browse/browse.routes') },
  { path: 'test', loadChildren: () => import('./features/test/test.routes') },
  { path: 'results', loadChildren: () => import('./features/results/results.routes') },
  { path: 'history', loadChildren: () => import('./features/history/history.routes') },
  { path: 'import', loadChildren: () => import('./features/import/import.routes') },
  { path: '**', redirectTo: '' },
];
