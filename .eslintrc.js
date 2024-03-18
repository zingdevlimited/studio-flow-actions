module.exports = {
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
    project: ["tsconfig.eslint.json"]
  },
  rules: {
    quotes: ["error", "double"],
    semi: ["error", "always"],

    // import and export rules
    // we want to have our project exports to be named (not default) unless necessary
    "import/prefer-default-export": "off",
    "import/no-default-export": "warn",
    "@typescript-eslint/no-explicit-any": "off",

    // standard extensions shouldn't be named with file extensions, but unusual ones (eg JS/css) should be.
    "import/extensions": [
      "error",
      {
        ts: "never",
        tsx: "never",
      },
    ],

    // linebreak settings - turn them off as windows git usually handles this
    "linebreak-style": "off",
    // prettier options
    "prettier/prettier": [
      "error",
      {
        // prettier rules that we'd like to enforce
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
        // this turns off the .prettierrc config file. you can use it,
        // but it's easier if we just have all our config in here
        usePrettierrc: false,
      },
    ],
    // these mess with prettier - turn them off
    "arrow-body-style": "off",
    "prefer-arrow-callback": "off",

    // react specific
    // prop type validation - doesn't play nicely with typescript, so let's disable it
    "react/prop-types": "off",
    // prefer destructuring but don't enforce it
    "react/destructuring-assignment": "warn",
    // react/no-array-index-key: we use this fairly often and it's safe
    "react/no-array-index-key": "error",
    "react-hooks/rules-of-hooks": "error", // Checks rules of Hooks
    "react-hooks/exhaustive-deps": "warn", // Checks effect dependencies
  }
};