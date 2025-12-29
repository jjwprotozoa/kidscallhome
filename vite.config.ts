import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { deferCssPlugin } from "./vite-plugin-defer-css";

// Read version from package.json for automatic injection
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "./package.json"), "utf8")
);
const appVersion = packageJson.version || "1.0.0";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Plugin to inject OG image URL, modulepreload links, and app version
  const htmlPlugin = () => {
    return {
      name: "html-transform",
      transformIndexHtml(html: string) {
        // For Open Graph images, always use the production domain
        // This ensures social media shares always show the correct image URL
        // regardless of whether it's a preview or production deployment
        const ogImageUrl = process.env.VITE_BASE_URL
          ? `${process.env.VITE_BASE_URL}/og-image.png`
          : "https://www.kidscallhome.com/og-image.png";

        // Inject app version as environment variable for runtime access
        let transformed = html.replace(/\{\{OG_IMAGE_URL\}\}/g, ogImageUrl);

        // Inject version into HTML as a script tag for runtime access
        // This allows getAppVersion() to read it if Capacitor isn't available
        if (!transformed.includes("VITE_APP_VERSION")) {
          transformed = transformed.replace(
            "<head>",
            `<head>\n    <script>window.__APP_VERSION__ = "${appVersion}";</script>`
          );
        }

        // Inject Supabase preconnect hint using the actual URL from environment
        // This reduces connection latency for API calls
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        if (supabaseUrl) {
          try {
            const supabaseOrigin = new URL(supabaseUrl).origin;
            // Replace both dns-prefetch and preconnect fallback with actual Supabase URL
            transformed = transformed.replace(
              '<link rel="dns-prefetch" href="https://supabase.co" />',
              `<link rel="dns-prefetch" href="${supabaseOrigin}" />`
            );
            transformed = transformed.replace(
              '<link rel="preconnect" href="https://supabase.co" crossorigin />',
              `<link rel="preconnect" href="${supabaseOrigin}" crossorigin />`
            );
          } catch {
            // If URL parsing fails, keep the generic dns-prefetch and preconnect
          }
        }

        // Add preconnect for self-origin to reduce critical path latency
        // This helps establish connection early for CSS/JS assets from same domain
        const baseUrl = process.env.VITE_BASE_URL || "https://www.kidscallhome.com";
        try {
          const selfOrigin = new URL(baseUrl).origin;
          // Only add if not already present
          if (!transformed.includes(`rel="preconnect" href="${selfOrigin}"`)) {
            transformed = transformed.replace(
              /<head>/i,
              `<head>\n    <link rel="preconnect" href="${selfOrigin}" crossorigin />`
            );
          }
        } catch {
          // If URL parsing fails, skip preconnect
        }

        return transformed;
      },
    };
  };

  // Plugin to remove console logs in production builds (security best practice)
  const removeConsolePlugin = () => {
    return {
      name: "remove-console",
      transform(code: string, id: string) {
        // Only remove console logs in production builds
        const isSourceFile =
          id.endsWith(".ts") ||
          id.endsWith(".tsx") ||
          id.endsWith(".js") ||
          id.endsWith(".jsx");
        // Skip node_modules files
        if (
          mode === "production" &&
          isSourceFile &&
          !id.includes("node_modules")
        ) {
          // Remove console.log, console.debug, console.info
          // Keep console.warn and console.error for critical errors
          // Use a more careful regex that handles multi-line and template literals
          let transformed = code;

          // Remove single-line console.log statements
          transformed = transformed.replace(/console\.log\([^;]*?\);?\s*/g, "");
          transformed = transformed.replace(
            /console\.debug\([^;]*?\);?\s*/g,
            ""
          );
          transformed = transformed.replace(
            /console\.info\([^;]*?\);?\s*/g,
            ""
          );

          return {
            code: transformed,
            map: null,
          };
        }
        return null;
      },
    };
  };

  return {
    // Only use index.html as entry point, ignore other HTML files
    root: process.cwd(),
    publicDir: "public",
    // Exclude android directory and other build directories from Vite scanning
    server: {
      host: "0.0.0.0", // Bind to all network interfaces
      port: 8080,
      // HTTPS disabled for now - use ngrok or similar for iOS testing
      // https: true, // Uncomment this if you set up proper certificates
      strictPort: false, // Allow port fallback if 8080 is taken
      // Allow ngrok and Cloudflare tunnel hosts for iPhone testing
      allowedHosts: [
        ".ngrok-free.app",
        ".ngrok.app",
        ".ngrok.io",
        ".trycloudflare.com",
      ],
      // Exclude android directory and build artifacts from file watching
      watch: {
        ignored: [
          "**/android/**",
          "**/ios/**",
          "**/node_modules/**",
          "**/dist/**",
          "**/.git/**",
          "**/public/**/*.html", // Exclude HTML files in public from being entry points
        ],
      },
    },
    plugins: [
      react(),
      htmlPlugin(),
      mode === "production" && deferCssPlugin(), // Defer CSS loading in production for faster FCP/LCP
      mode === "development" && componentTagger(),
      // Console removal plugin disabled - regex-based removal is too aggressive and breaks builds
      // TODO: Implement proper AST-based console removal if needed
      // mode === "production" && removeConsolePlugin()
      // PWA plugin - temporarily disabled due to date-fns v3.x module resolution issues on Windows
      // TODO: Re-enable once date-fns is updated or PWA plugin handles it better
      // Temporarily disabled - uncomment when date-fns issue is resolved
      false && VitePWA({
        registerType: "autoUpdate",
        // Defer SW registration until page is idle to reduce critical path
        // This prevents registerSW.js from blocking initial render
        injectRegister: "script-defer",
        workbox: {
          // Cache version for cache busting on deployment
          cacheId: "kidscallhome-v1",
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          // In development, disable precaching to reduce console noise
          globPatterns:
            mode === "development"
              ? [] // Don't precache anything in development
              : ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          globIgnores: [
            "**/node_modules/**/*",
            "**/src/**/*", // Exclude all source files
            "**/@vite/**/*",
            "**/@react-refresh/**/*",
            "**/*.map",
            "**/*.ts", // Exclude TypeScript source files
            "**/*.tsx", // Exclude TSX source files
            "**/kids-video-calling-kindle.html", // Exclude files that return 403
            "**/*-kindle.html", // Exclude kindle-specific pages
            "**/date-fns/**/*", // Exclude date-fns from PWA precaching to avoid build issues
          ],
          // Handle precaching errors gracefully
          dontCacheBustURLsMatching: /\.\w{8}\./,
          // Skip waiting and claim clients immediately for faster updates
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          // Suppress Workbox warnings for expected cases
          // This prevents console spam from source files and API requests
          mode: mode === "development" ? "development" : "production",
          // Navigation fallback to root instead of index.html
          navigateFallback: "/",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/_next-live\//,
            /^\/src\//, // Exclude source files from navigation fallback
            /\.(?:json|xml|txt|ts|tsx)$/, // Exclude source files and data files
          ],
          // Import custom notification handlers into the generated service worker
          // This file contains push notification and notificationclick event handlers
          importScripts: ["/notification-handlers.js"],
          // Suppress Workbox warnings for expected cases (source files, API requests)
          // This prevents console spam in development
          disableDevLogs: mode === "development",
          // Runtime caching rules for external resources
          runtimeCaching: [
            {
              // Supabase REST API calls - always go to network, never cache
              // This prevents "No route found" console spam from polling calls
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
              handler: "NetworkOnly",
            },
            {
              // Supabase Auth API calls - always go to network
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\/.*/i,
              handler: "NetworkOnly",
            },
            {
              // Supabase Realtime WebSocket - always go to network
              urlPattern: /^https:\/\/.*\.supabase\.co\/realtime\/.*/i,
              handler: "NetworkOnly",
            },
            {
              // Supabase Storage images - cache for 7 days
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "supabase-storage",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts stylesheets
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-stylesheets",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts webfonts
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        // PWA manifest configuration
        manifest: {
          name: "Kids Call Home",
          short_name: "KidsCallHome",
          description:
            "Safe video calling and messaging app for kids. Family-only contacts controlled by parents. Works on most phones and tablets over Wi‑Fi or mobile data, no phone number or SIM card required. No ads, no strangers, no filters, no data tracking.",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        // Disable PWA in development to avoid Workbox console spam
        // In dev mode, Vite serves files from /src/, /@vite/, /node_modules/.vite/deps/
        // which would all trigger "No route found" warnings from the service worker
        devOptions: {
          enabled: false,
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
      // Fix for date-fns module resolution issues on Windows
      dedupe: ["date-fns"],
    },
    optimizeDeps: {
      // Pre-bundle date-fns to avoid module resolution issues during build
      include: ["date-fns"],
      exclude: [],
      // Ignore source map errors during dependency optimization
      esbuildOptions: {
        // Ignore corrupted source maps - don't fail on source map parsing errors
        legalComments: "none",
        // Skip source map loading to avoid corrupted source map errors
        sourcemap: false,
      },
      // Only scan index.html, not HTML files in public or android directories
      entries: [
        path.resolve(__dirname, "./index.html"),
      ],
    },
    // Inject app version as environment variable
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
        // Handle date-fns ESM modules properly
        esmExternals: true,
      },
      // Remove console statements in production builds
      minify: "esbuild",
      terserOptions: undefined, // Use esbuild minification
      // Configure esbuild to drop console statements in production
      esbuild: {
        drop: mode === "production" ? ["console", "debugger"] : [],
      },
      // CSS optimization for faster FCP
      cssCodeSplit: true, // Split CSS per component (lazy-loaded routes get their CSS later)
      cssMinify: true, // Minify CSS for smaller bundle
      // Reduce initial bundle size by optimizing chunk splitting
      // Target smaller chunks for better parallel loading
      chunkSizeWarningLimit: 500, // Lower limit to catch large chunks earlier
      // Vendor chunk splitting for weak network conditions (LTE/2G)
      // This separates rarely-changing vendor code from frequently-updated application code,
      // optimizing caching and reducing download size on slow networks.
      // Vendor chunks can be cached indefinitely since they rarely change,
      // while app code chunks are smaller and update more frequently.
      rollupOptions: {
        // Only use index.html as entry point, ignore HTML files in public/ and android/
        input: path.resolve(__dirname, "./index.html"),
        output: {
          manualChunks: (id) => {
            // Exclude date-fns from manual chunking to avoid module resolution issues
            if (id.includes("date-fns")) {
              return "date-fns-vendor";
            }
            
            // Split React core from React DOM for better code splitting
            // React core is smaller and needed earlier, React DOM can load later
            if (id.includes("react/") && !id.includes("react-dom")) {
              return "react-core-vendor";
            }
            
            // React DOM - larger, can be loaded separately
            if (id.includes("react-dom")) {
              return "react-dom-vendor";
            }
            
            // React Router - separate chunk since it's only needed for routing
            if (id.includes("react-router")) {
              return "react-router-vendor";
            }
            
            // TanStack Query - data fetching library, stable API
            // Split into separate chunk - only needed in app routes, not marketing
            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }
            
            // Supabase client - database and auth, stable SDK
            // CRITICAL: This should NEVER be in the initial bundle for marketing routes
            // Keep in separate chunk so it can be lazy-loaded
            if (id.includes("@supabase")) {
              return "supabase-vendor";
            }
            
            // Capacitor native mobile APIs - rarely change, only needed in app
            if (id.includes("@capacitor")) {
              return "capacitor-vendor";
            }
            
            // Radix UI components - split into smaller chunks for better tree-shaking
            // Only load what's needed per route
            if (id.includes("@radix-ui")) {
              return "radix-vendor";
            }
            
            // WebRTC-related code - separate chunk for better code splitting
            // This helps reduce initial bundle size since WebRTC is only needed during calls
            if (id.includes("useWebRTC") || id.includes("webrtc") || id.includes("WebRTC") || 
                id.includes("features/calls")) {
              return "webrtc-vendor";
            }
            
            // Lucide icons - large library, split into separate chunk
            // Only load icons when needed
            if (id.includes("lucide-react")) {
              return "lucide-vendor";
            }
            
            // Default: let Vite handle other chunks
            return null;
          },
        },
      },
      // Chunk size warning limit set above in build config
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
      exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    },
  };
});
