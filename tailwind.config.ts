import type { Config } from "tailwindcss";

// 设计令牌集中管理：换肤/换字体只需改这里 + globals.css 的 CSS 变量（延展性 C）
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 语义色：值取自 CSS 变量，亮/暗模式由 globals.css 切换
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        border: "var(--border-color)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        // 主色：品牌蓝（与 design-preview 1:1 对齐）
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1E40AF",
          800: "#1E3A8A",
          900: "#172554",
        },
        // 强调色：琥珀
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#b45309",
        },
      },
      fontFamily: {
        sans: ["var(--font-fira-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.08)",
        "card-hover": "0 4px 12px -2px rgb(0 0 0 / 0.12)",
        drawer: "-8px 0 24px -8px rgb(0 0 0 / 0.18)",
      },
    },
  },
  plugins: [],
};
export default config;
