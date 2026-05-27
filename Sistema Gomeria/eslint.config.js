import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/**',
      'scripts/**',
      '*.config.js',
      '*.config.ts',
      'src/types/database.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Reglas que previenen la clase de bug "useEffect re-disparado por callback no estable".
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Permitir patrones comunes del repo sin ruido.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Vite/Tailwind config patterns; preferred over disabling rule-of-hooks.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
);
