import { Routes } from '@angular/router';

export default [{ path: '', loadComponent: () => import('./pages/import.page').then((m) => m.ImportPage), title: 'Import · CT-PT Practice' }] satisfies Routes;
