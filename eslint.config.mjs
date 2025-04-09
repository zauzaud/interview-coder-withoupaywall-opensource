// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.json"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules }, // Spread the rules object
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules }, // Spread the rules object
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules }, // Spread the rules object
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    rules: { ...markdown.configs.recommended.rules }, // Spread the rules object
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    rules: { ...css.configs.recommended.rules }, // Spread the rules object
  },
];