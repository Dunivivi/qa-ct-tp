import { Routes } from '@angular/router';

export default [{ path: '', loadComponent: () => import('./pages/library.page').then((m) => m.LibraryPage), title: 'Library · CT-PT Practice' }] satisfies Routes;
