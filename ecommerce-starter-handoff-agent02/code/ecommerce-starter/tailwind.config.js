/** Brand values come from CSS variables set per brand (src/config/brands.ts). */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "480px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1440px" },
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), alt: v("alt"), ink: v("text"), muted: v("muted"),
        line: v("border"), "line-strong": v("border-strong"),
        primary: v("primary"), "primary-soft": v("primary-soft"), "primary-ink": v("primary-ink"),
        accent: v("accent"), "on-accent": v("on-accent"), success: v("success"), warning: v("warning"), danger: v("danger"), focus: v("focus"),
      },
      fontFamily: { display: "var(--font-display)", body: "var(--font-body)", mono: "var(--font-mono)" },
      borderRadius: { brand: "var(--radius)", ctl: "var(--radius-ctl)" },
    },
  },
  plugins: [],
};
