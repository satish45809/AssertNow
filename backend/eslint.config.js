import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'docs/**', 'eslint.config.js', 'vitest.config.ts']
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['jsforce', 'jsforce/*'],
              message: 'jsforce may only be imported inside src/integrations/salesforce/'
            }
          ]
        }
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'process.env may only be read in src/config/env.ts'
        }
      ]
    }
  },
  {
    files: ['src/config/env.ts', 'scripts/testSalesforce.ts'],
    rules: {
      'no-restricted-properties': 'off'
    }
  },
  {
    files: ['src/integrations/salesforce/**'],
    rules: {
      'no-restricted-imports': 'off'
    }
  }
);

