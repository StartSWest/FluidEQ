module.exports = {
  // Stop here. This is the project root, and there is no configuration above
  // it that should ever apply — but a git worktree lives inside the checkout,
  // at .claude/worktrees/<name>, so eslint walks up out of it and finds the
  // main checkout's copy of this same file. Both extend `erb`, which registers
  // the `compat` plugin, and it then resolves out of two different node_modules
  // trees: "ESLint couldn't determine the plugin 'compat' uniquely", and the
  // pre-commit hook refuses every commit made from a worktree.
  root: true,
  extends: 'erb',
  // `erb` wires up `@typescript-eslint/parser` but never registers the
  // plugin of the same name, so any `@typescript-eslint/*` rule added below
  // fails to resolve without this. Confirmed with
  // `pnpm exec eslint --print-config`, whose `plugins` array was missing it.
  plugins: ['@typescript-eslint'],
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': 'error',
    // The current TypeScript resolver handles these extensions. The inherited
    // ERB rules still expect JavaScript-only filenames.
    'import/extensions': 'off',
    // Since React 17 and typescript 4.1 you can safely disable the rule
    'react/react-in-jsx-scope': 'off',
    // According to this:
    // https://stackoverflow.com/questions/47774695/react-functional-component-default-props-vs-default-parameters
    // defaultProps is going to be deprecated and we should turn off this rule.
    'react/require-default-props': 'off',
    'react/function-component-definition': 'off',
    'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
    // Type-only function signatures are incorrectly reported by the base rule.
    'no-unused-vars': 'off',
    // Promise chains in effects explicitly handle errors before finally().
    'promise/catch-or-return': 'off',
    'no-await-in-loop': 'off',
    'import/prefer-default-export': 'warn',
    curly: ['error', 'all'],
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    // Both, because the end-to-end suite is deliberately outside the app's
    // tsconfig — it drives a real browser and pulls in webdriver types the app
    // has no business seeing. Listing only the app's config means eslint
    // cannot parse those files at all and refuses the commit.
    project: ['./tsconfig.json', './tsconfig.e2e.json'],
    tsconfigRootDir: __dirname,
    createDefaultProgram: true,
  },
  env: {
    'jest/globals': true,
  },
  overrides: [
    {
      files: ['*.js'],
      parserOptions: { project: null },
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-shadow': 'off',
        'no-use-before-define': 'off',
        'no-undef': 'off',
      },
    },
    {
      // A value import from src/main drags Node built-ins and Electron into
      // this bundle — see src/common/library/mediaUrl.ts's own comment for
      // the concrete incident. `allowTypeImports` leaves `import type`
      // alone: it is erased before webpack ever sees it, so it cannot pull
      // anything in. Scoped to the renderer only — main imports from main/
      // constantly and legitimately.
      files: ['src/renderer/**'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/main/**', 'main/*'],
                allowTypeImports: true,
                message:
                  'A value import from src/main pulls Node built-ins (fs, path, crypto) and Electron itself into the renderer bundle, and pnpm build:renderer fails with "Can\'t resolve" errors. Move the shared code to src/common/ instead, or use `import type` if only a type is needed.',
              },
            ],
          },
        ],
      },
    },
    {
      // Ambient declaration files (preload.d.ts's `import api from
      // 'main/api'`) are never emitted to JavaScript, so a value import here
      // is erased at compile time same as `import type` and cannot reach the
      // renderer bundle.
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-restricted-imports': 'off',
      },
    },
  ],
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {},
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
      typescript: {},
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};
