// ING-9: lint en modo aviso (no rompe el CI). Sube a error regla por regla a
// medida que se limpia el código. `no-empty` en aviso marca los `catch {}`
// silenciosos (ING-5): lo correcto es registrar con logClientError.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const warnAll = (rules) => Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, Array.isArray(v) ? ['warn', ...v.slice(1)] : (v === 'off' || v === 0 ? v : 'warn')]))

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'supabase/functions/**', 'coverage/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...warnAll(js.configs.recommended.rules),
      ...warnAll(reactHooks.configs.recommended.rules),
      ...warnAll(jsxA11y.flatConfigs.recommended.rules),
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: false }],
    },
  },
]
