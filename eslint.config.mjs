import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // engineering-standards.md: no rendering of untrusted HTML, no `any` without a reason, nothing personal in console logs.
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-eval": "error",
      "no-implied-eval": "error",
      // Accessibility is non-negotiable: eslint-config-next only warns on a few jsx-a11y rules.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/interactive-supports-focus": "error",
    },
  },
  {
    // User-facing text lives in messages/en.json, never as JSX literals.
    files: ["src/**/*.tsx"],
    ignores: ["src/**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: false,
          allowedStrings: ["·", "→", "/", "–", "—", "(", ")", ":", "*"],
        },
      ],
    },
  },
  // Must stay last: turns off stylistic rules that Prettier owns.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare build output and Wrangler state (npm run cf:build)
    ".open-next/**",
    ".wrangler/**",
    // Test output
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "playwright/.cache/**",
    // Generated from the backend contract (npm run contract:sync); lint --fix must never rewrite it.
    "src/lib/api/schema.d.ts",
    "src/lib/api/openapi.json",
  ]),
]);

export default eslintConfig;
