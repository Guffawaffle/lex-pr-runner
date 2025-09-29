module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2021: true,
  },
  rules: {
    // Enforce a single trailing newline at end of file
    'eol-last': ['error', 'always'],
  },
};
