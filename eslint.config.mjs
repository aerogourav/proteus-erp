import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `let [id, state] = nextId(state, …)` reassigns only `state`; that destructuring is intended.
  { rules: { "prefer-const": ["error", { destructuring: "all" }] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-proteus-check*/**",
    ".next-proteus-*/**",
    ".next.previous-build/**",
    "out/**",
    "build/**",
    "node_modules.setup-backup/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
