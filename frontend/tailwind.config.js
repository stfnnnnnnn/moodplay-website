/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // the web demo has its own scoped CSS (src/demo/demo.css); keep its class names out of the landing CSS
    "!./src/demo/**",
    // the error boundary is styled inline; its words (static, inline, grid) would otherwise add utilities to the landing CSS
    "!./src/ErrorBoundary.tsx",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}