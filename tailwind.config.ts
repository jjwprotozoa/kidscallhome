import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Lexend', 'Arial', 'Verdana', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        kid: {
          blue: "hsl(var(--kid-blue))",
          orange: "hsl(var(--kid-orange))",
          green: "hsl(var(--kid-green))",
          purple: "hsl(var(--kid-purple))",
          pink: "hsl(var(--kid-pink))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chat: {
          accent: "hsl(var(--chat-accent))",
          "accent-foreground": "hsl(var(--chat-accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        // Child login onboarding animations
        "gentle-pulse": {
          "0%, 100%": { 
            transform: "scale(1)",
            boxShadow: "0 0 0 0 hsl(var(--primary) / 0.4)",
          },
          "50%": { 
            transform: "scale(1.02)",
            boxShadow: "0 0 0 8px hsl(var(--primary) / 0)",
          },
        },
        "swipe-hint-left": {
          "0%, 100%": { 
            transform: "translateX(0)",
            opacity: "0.7",
          },
          "50%": { 
            transform: "translateX(-8px)",
            opacity: "1",
          },
        },
        "swipe-hint-right": {
          "0%, 100%": { 
            transform: "translateX(0)",
            opacity: "0.7",
          },
          "50%": { 
            transform: "translateX(8px)",
            opacity: "1",
          },
        },
        "tap-hint": {
          "0%, 100%": { 
            transform: "scale(1)",
            opacity: "0.8",
          },
          "50%": { 
            transform: "scale(0.95)",
            opacity: "1",
          },
        },
        "float-up": {
          "0%": { 
            opacity: "0",
            transform: "translateY(10px)",
          },
          "20%": { 
            opacity: "1",
            transform: "translateY(0)",
          },
          "80%": { 
            opacity: "1",
            transform: "translateY(0)",
          },
          "100%": { 
            opacity: "0",
            transform: "translateY(-10px)",
          },
        },
        "bounce-gentle": {
          "0%, 100%": { 
            transform: "translateY(0)",
          },
          "50%": { 
            transform: "translateY(-4px)",
          },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spin-slow": "spin-slow 3s linear infinite",
        "fade-in": "fade-in 0.6s ease-out",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        // Child login onboarding animations
        "gentle-pulse": "gentle-pulse 2s ease-in-out infinite",
        "swipe-hint-left": "swipe-hint-left 1.5s ease-in-out infinite",
        "swipe-hint-right": "swipe-hint-right 1.5s ease-in-out infinite",
        "tap-hint": "tap-hint 1s ease-in-out infinite",
        "float-up": "float-up 3s ease-in-out forwards",
        "bounce-gentle": "bounce-gentle 1s ease-in-out infinite",
        "wiggle": "wiggle 0.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
