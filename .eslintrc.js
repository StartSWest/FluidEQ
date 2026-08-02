module.exports = {
  extends: 'erb',
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
    project: './tsconfig.json',
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
