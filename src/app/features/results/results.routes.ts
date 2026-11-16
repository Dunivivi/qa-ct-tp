import { Routes } from '@angular/router';

export default [
  { path: ':id', loadComponent: () => import('./pages/results.page').then((m) => m.ResultsPage), title: 'Results · CT-PT Practice' },
  { path: '', redirectTo: '/history', pathMatch: 'full' },
] satisfies Routes;
