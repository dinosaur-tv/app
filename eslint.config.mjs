import eslint from "@eslint/js";

export default [
  { ignores: ["node_modules/**", "output/**", ".playwright-cli/**"] },
  eslint.configs.recommended,
  {
    // The desktop shell is CommonJS on Node, not a page in the browser.
    files: ["desktop/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", console: "readonly", URL: "readonly" },
    },
  },
  {
    ignores: ["desktop/**/*.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        history: "readonly",
        navigator: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        AbortSignal: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        innerHeight: "readonly",
        innerWidth: "readonly",
      },
    },
  },
];
