import eslint from "@eslint/js";

export default [
  { ignores: ["node_modules/**", "output/**", ".playwright-cli/**"] },
  eslint.configs.recommended,
  {
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
        URL: "readonly",
        URLSearchParams: "readonly",
        innerHeight: "readonly",
        innerWidth: "readonly",
      },
    },
  },
];
