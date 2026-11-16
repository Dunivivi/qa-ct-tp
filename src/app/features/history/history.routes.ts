import { Routes } from '@angular/router';

export default [{ path: '', loadComponent: () => import('./pages/history.page').then((m) => m.HistoryPage), title: 'History · CT-PT Practice' }] satisfies Routes;
