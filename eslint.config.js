// ING-9: las reglas siguen en 'warn', pero `npm run lint` corre con
// `--max-warnings 0` (21-oct-2026, 124 → 0 avisos), así que en el CI un aviso
// nuevo rompe el build igual que un error. Si una regla no se puede cumplir sin
// cambiar el comportamiento: `// eslint-disable-next-line <regla> -- <motivo>`,
// siempre con la regla y el motivo. `no-empty` ya es error: un `catch` no puede
// quedar vacío (ING-5); se registra con logClientError o se explica en un
// comentario por qué es seguro ignorar el fallo.
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
      ...js.configs.recommended.rules,
      'no-useless-escape': 'warn',
      ...warnAll(reactHooks.configs.recommended.rules),
      ...warnAll(jsxA11y.flatConfigs.recommended.rules),
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      // ING-5: tampoco .catch(() => {}); se usa logRejection('archivo:línea') o un comentario dentro.
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='BlockStatement'][body.body.length=0]",
        message: 'Promesa ignorada en silencio: usa .catch(logRejection(...)) o explica en un comentario por qué es seguro.',
      }],
    },
  },
  { files: ['**/*.test.{js,jsx}'], rules: { 'no-restricted-syntax': 'off' } },
]
