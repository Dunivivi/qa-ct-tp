import { Routes } from '@angular/router';

export default [{ path: '', loadComponent: () => import('./pages/browse.page').then((m) => m.BrowsePage), title: 'Browse · CT-PT Practice' }] satisfies Routes;
