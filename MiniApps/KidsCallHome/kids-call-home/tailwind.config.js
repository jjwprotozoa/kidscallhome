import { defineConfig } from '@tailwindcss/vite'

export default defineConfig({
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple System Colors - Guardian Theme (Professional)
        guardian: {
          primary: '#007AFF',        // iOS Blue
          secondary: '#5856D6',      // iOS Purple
          accent: '#00C7BE',         // iOS Teal
          surface: '#FFFFFF',
          'surface-secondary': '#F2F2F7',
          text: '#000000',
          'text-secondary': '#3C3C43',
          'text-muted': '#8E8E93',
          border: '#C6C6C8',
          50: '#E5F3FF',
          100: '#CCE7FF',
          200: '#99CFFF',
          300: '#66B7FF',
          400: '#339FFF',
          500: '#007AFF',
          600: '#0062CC',
          700: '#004999',
          800: '#003166',
          900: '#001933',
        },
        // Apple System Colors - Kids Theme (Playful)
        kids: {
          primary: '#FF9500',        // iOS Orange
          secondary: '#FF2D92',      // iOS Pink
          accent: '#AF52DE',         // iOS Purple
          surface: '#FFFFFF',
          'surface-secondary': '#F2F2F7',
          text: '#000000',
          'text-secondary': '#3C3C43',
          'text-muted': '#8E8E93',
          border: '#C6C6C8',
          50: '#FFF4E6',
          100: '#FFE9CC',
          200: '#FFD399',
          300: '#FFBD66',
          400: '#FFA733',
          500: '#FF9500',
          600: '#CC7700',
          700: '#995900',
          800: '#663B00',
          900: '#331D00',
        },
        // Apple Status Colors
        success: '#34C759',      // iOS Green
        warning: '#FF9500',      // iOS Orange
        error: '#FF3B30',        // iOS Red
        info: '#007AFF',         // iOS Blue
      },
      screens: {
        'sm': '640px',    // Large phones
        'md': '768px',    // Tablets  
        'lg': '1024px',   // Small laptops
        'xl': '1280px',   // Desktop
        '2xl': '1536px',  // Large desktop
      },
      fontFamily: {
        // Apple's SF Pro font stack with fallbacks
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
        'display': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'caption': ['12px', { lineHeight: '1.58', letterSpacing: '-0.022em' }],
        'footnote': ['13px', { lineHeight: '1.54', letterSpacing: '-0.022em' }],
        'subhead': ['15px', { lineHeight: '1.53', letterSpacing: '-0.022em' }],
        'callout': ['16px', { lineHeight: '1.5', letterSpacing: '-0.022em' }],
        'body': ['17px', { lineHeight: '1.47', letterSpacing: '-0.022em' }],
        'headline': ['17px', { lineHeight: '1.35', letterSpacing: '-0.022em' }],
        'title3': ['20px', { lineHeight: '1.3', letterSpacing: '-0.022em' }],
        'title2': ['22px', { lineHeight: '1.27', letterSpacing: '-0.022em' }],
        'title1': ['28px', { lineHeight: '1.25', letterSpacing: '-0.022em' }],
        'large-title': ['34px', { lineHeight: '1.2', letterSpacing: '-0.022em' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        'small': '8px',
        'medium': '12px',
        'large': '16px',
        'xl': '20px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'pulse-gentle': 'pulse-gentle 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
        'bounce-subtle': 'bounce-subtle 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
        'wiggle-gentle': 'wiggle-gentle 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
      },
      keyframes: {
        'pulse-gentle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'wiggle-gentle': {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        }
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Apple's standard easing
      }
    },
  },
  plugins: [],
})
