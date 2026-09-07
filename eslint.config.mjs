import eslint from "@eslint/js";

export default [
  { ignores: ["node_modules/**"] },
  eslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        location: "readonly",
        history: "readonly",
        navigator: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        FileReader: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
];
