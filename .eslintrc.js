module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: ['eslint:recommended'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    wx: 'readonly',
    canvas: 'readonly',
    require: 'readonly',
    module: 'readonly',
    worker: 'readonly',
    exports: 'readonly',
    GameGlobal: 'readonly',
    requirePlugin: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "no-unused-vars": "warn"
  },
};
