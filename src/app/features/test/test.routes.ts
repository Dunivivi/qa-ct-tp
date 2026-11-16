import { Routes } from '@angular/router';

export default [{ path: '', loadComponent: () => import('./pages/test-runner.page').then((m) => m.TestRunnerPage), title: 'Test · CT-PT Practice' }] satisfies Routes;
