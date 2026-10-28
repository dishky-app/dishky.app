/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.js"],
  theme: {
    // Mirrors the project breakpoint system (see src/styles/variables.css).
    // Tailwind is mobile-first: an unprefixed utility applies at every width,
    // `sm:` from 480px up, etc. `xs` is available for the sub-480 tier.
    screens: {
      xs: "375px",
      sm: "480px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        ink: "#000000",
        charcoal: "#1a1a1a",
        cream: "#ffffff",
        beige: "#ffffff",
        cocoa: "#111111",
        amber: "#f33716",
        amberLight: "#e63719",
      },
      fontFamily: {
        display: ["'Sora'", "system-ui", "sans-serif"],
        body: ["'Manrope'", "system-ui", "sans-serif"],
        // Three families in total: Sora, Manrope and JetBrains Mono. No italic or cursive faces.
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        serif: ["'Sora'", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        dishky: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
