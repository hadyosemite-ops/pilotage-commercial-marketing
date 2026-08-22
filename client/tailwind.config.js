/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0D1B2A",
        accent: "#0F7173",
        mint: "#5DCAA5",
      },
    },
  },
  plugins: [],
};
