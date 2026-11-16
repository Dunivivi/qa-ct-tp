// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const boundaries = require('eslint-plugin-boundaries');

module.exports = tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'public/**', 'scripts/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/app/**/*'],
      // Without a TS resolver, extension-less imports are 'unknown' and silently allowed.
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/app*', mode: 'file' },
        { type: 'core', pattern: 'src/app/core' },
        { type: 'shared', pattern: 'src/app/shared' },
        { type: 'layout', pattern: 'src/app/layout' },
        { type: 'feature', pattern: 'src/app/features/*', capture: ['feature'] },
      ],
    },
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: ['app', 'ui'], style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: ['app', 'ui'], style: 'camelCase' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // A feature can be deleted with rm -rf: nothing outside it may depend on it,
      // and it may only reach into core/shared — never into another feature.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['app', 'core', 'shared', 'layout', 'feature'] },
            { from: 'layout', allow: ['core', 'shared'] },
            { from: 'core', allow: ['core', 'shared'] },
            { from: 'shared', allow: ['shared'] },
            { from: 'feature', allow: ['core', 'shared', ['feature', { feature: '${from.feature}' }]] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
