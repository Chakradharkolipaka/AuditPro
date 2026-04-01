// ESLint v9+ flat config
// Minimal config to keep code quality checks working in this repo.

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node globals
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",

        // Web/undici globals in Node 18+
        AbortController: "readonly",

        // Node 18+ global fetch
        fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
