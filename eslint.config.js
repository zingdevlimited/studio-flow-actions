const js = require("@eslint/js");
const { fixupConfigRules } = require("@eslint/compat");
const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const typeScriptRuleAliases = {
  "@typescript-eslint/brace-style": "brace-style",
  "@typescript-eslint/block-spacing": "block-spacing",
  "@typescript-eslint/comma-dangle": "comma-dangle",
  "@typescript-eslint/comma-spacing": "comma-spacing",
  "@typescript-eslint/func-call-spacing": "func-call-spacing",
  "@typescript-eslint/indent": "indent",
  "@typescript-eslint/key-spacing": "key-spacing",
  "@typescript-eslint/keyword-spacing": "keyword-spacing",
  "@typescript-eslint/lines-around-comment": "lines-around-comment",
  "@typescript-eslint/lines-between-class-members": "lines-between-class-members",
  "@typescript-eslint/no-extra-parens": "no-extra-parens",
  "@typescript-eslint/no-extra-semi": "no-extra-semi",
  "@typescript-eslint/no-throw-literal": "no-throw-literal",
  "@typescript-eslint/object-curly-spacing": "object-curly-spacing",
  "@typescript-eslint/quotes": "quotes",
  "@typescript-eslint/semi": "semi",
  "@typescript-eslint/space-before-blocks": "space-before-blocks",
  "@typescript-eslint/space-before-function-paren": "space-before-function-paren",
  "@typescript-eslint/space-infix-ops": "space-infix-ops",
};

const configs = compat.config({
  env: {
    browser: true,
    es6: true,
    jest: true,
  },
  settings: {
    jest: {
      version: 26,
    },
    react: {
      version: "17.0.2",
    },
  },
  extends: [
    "airbnb-typescript",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:jest/recommended",
  ],
  plugins: [
    "react",
    "@typescript-eslint",
    "jest",
    "eslint-plugin-import",
    "react-hooks",
  ],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: "module",
    project: ["tsconfig.eslint.json"],
  },
  rules: {
    quotes: ["error", "double"],
    semi: ["error", "always"],
    "import/prefer-default-export": "off",
    "import/no-default-export": "warn",
    "@typescript-eslint/no-explicit-any": "off",
    "prefer-const": "off",
    "import/extensions": [
      "error",
      {
        ts: "never",
        tsx: "never",
      },
    ],
    "linebreak-style": "off",
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
        trailingComma: "es5",
        printWidth: 100,
        tabWidth: 2,
        semi: true,
        singleQuote: false,
        jsxSingleQuote: false,
        jsxBracketSameLine: false,
        arrowParens: "always",
        parser: "typescript",
      },
      {
        usePrettierrc: false,
      },
    ],
    "arrow-body-style": "off",
    "prefer-arrow-callback": "off",
    "react/prop-types": "off",
    "react/destructuring-assignment": "warn",
    "react/no-array-index-key": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
});

for (const config of configs) {
  for (const [typeScriptRule, coreRule] of Object.entries(typeScriptRuleAliases)) {
    if (config.rules?.[typeScriptRule]) {
      config.rules[coreRule] = config.rules[typeScriptRule];
      delete config.rules[typeScriptRule];
    }
  }
  delete config.rules?.["@typescript-eslint/member-delimiter-style"];
  delete config.rules?.["@typescript-eslint/type-annotation-spacing"];
}

module.exports = fixupConfigRules(configs);