import { Routes } from '@angular/router';

export default [{ path: '', loadComponent: () => import('./pages/learn.page').then((m) => m.LearnPage), title: 'Learn · CT-PT Practice' }] satisfies Routes;
