import eslint from "@eslint/js";

export default [
  { ignores: ["node_modules/**"] },
  eslint.configs.recommended,
  {
    languageOptions: {
      globals: { window: "readonly", document: "readonly", fetch: "readonly" },
    },
  },
];
