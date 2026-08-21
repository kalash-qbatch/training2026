import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    plugins: {
      import: importPlugin,
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
    },

    rules: {
      /**
       * Imports: React first, followed by external packages, internal aliases, relative paths, types, side-effects
       */
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Side effect imports (e.g. `import "./styles.css";`)
            ["^\\u0000"],
            // 1. `react` and `react-dom` packages at the very top
            ["^react$", "^react-dom$", "^react/", "^react-dom/"],
            // 2. Other npm / external packages (e.g. `next`, `lucide-react`)
            ["^@?\\w"],
            // 3. Internal alias imports (e.g. `@/...`)
            ["^@/"],
            // 4. Parent imports (`../`), sibling and index imports (`./`)
            ["^\\.\\.(?!/?$)", "^\\.\\./?$", "^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            // 5. Style imports
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",

      /**
       * Remove unused imports automatically
       */
      "unused-imports/no-unused-imports": "error",

      /**
       * Allow variables prefixed with _
       */
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      /**
       * General
       */
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",

      /**
       * TypeScript
       */
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
        },
      ],

      /**
       * React / Next
       */
      "@next/next/no-img-element": "warn",
    },
  },

  eslintConfigPrettier,

  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "dist/**", "next-env.d.ts"]),
]);
