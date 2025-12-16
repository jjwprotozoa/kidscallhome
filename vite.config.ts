import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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
    },
    plugins: [
      react(),
      htmlPlugin(),
      mode === "development" && componentTagger(),
      // Console removal plugin disabled - regex-based removal is too aggressive and breaks builds
      // TODO: Implement proper AST-based console removal if needed
      // mode === "production" && removeConsolePlugin()
      // PWA plugin with aggressive vendor caching for weak network conditions (LTE/2G)
      // Caching strategy:
      // - CacheFirst for vendor chunks (rarely change, can be cached 30 days)
      // - NetworkFirst for main app bundle (frequently updated)
      // - StaleWhileRevalidate for other chunks (balance freshness and speed)
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          // Cache version for cache busting on deployment
          cacheId: "kidscallhome-v1",
          // Maximum cache age: 30 days for vendors, 7 days for app code
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          // Exclude source files and API endpoints from precaching
          globIgnores: [
            "**/node_modules/**/*",
            "**/src/**/*",
            "**/@vite/**/*",
            "**/@react-refresh/**/*",
            "**/*.map",
            "**/*.html", // Exclude HTML files from precaching - they're served directly and cached at runtime
          ],
          // Exclude source files and API endpoints from navigation fallback
          navigateFallbackDenylist: [
            // Exclude source files
            /^\/src\//,
            // Exclude Vite dev server files
            /^\/@vite\//,
            /^\/@react-refresh\//,
            /^\/node_modules\//,
            // Exclude API endpoints
            /^https:\/\/.*\.supabase\.co\//,
            /^https:\/\/api\./,
            /^https:\/\/fonts\./,
            /^https:\/\/fonts\.gstatic\.com\//,
          ],
          // Suppress workbox console logs in development by filtering out noisy messages
          // The navigateFallbackDenylist above prevents workbox from trying to handle
          // source files and API endpoints, which reduces the number of log messages
          // In development, disable precaching to reduce console noise
          ...(mode === "development" && {
            // Disable precaching in development to reduce console noise
            // Workbox will still function for runtime caching
            // Note: This prevents workbox from trying to precache source files
            // which causes hundreds of "Precaching did not find a match" messages
            // The precache manifest will be empty in development
            globPatterns: [], // Don't precache anything in development
          }),
          // Runtime caching strategies
          runtimeCaching: [
            // CacheFirst strategy for vendor chunks - these rarely change
            // Cache for 30 days to maximize repeat visit performance
            {
              urlPattern:
                /\/assets\/(react-vendor|supabase-vendor|radix-vendor|query-vendor|capacitor-vendor)-.*\.js/,
              handler: "CacheFirst",
              options: {
                cacheName: "vendor-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // NetworkFirst strategy for main app bundle - prioritize freshness
            // Falls back to cache if network fails (offline support)
            {
              urlPattern: /\/assets\/index-.*\.js/,
              handler: "NetworkFirst",
              options: {
                cacheName: "app-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 3, // Fallback to cache after 3s on slow networks
              },
            },
            // StaleWhileRevalidate for other chunks - balance freshness and speed
            // Serves from cache immediately, updates in background
            {
              urlPattern: /\/assets\/.*\.js/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "chunks-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Cache CSS and other static assets
            {
              urlPattern:
                /\/assets\/.*\.(css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico)/,
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
              },
            },
            // Cache HTML files at runtime (excluded from precaching to avoid 403 errors)
            // Use NetworkFirst to ensure fresh content, but cache for offline support
            {
              urlPattern: /\/.*\.html$/,
              handler: "NetworkFirst",
              options: {
                cacheName: "html-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 3, // Fallback to cache after 3s
              },
            },
          ],
          // Skip waiting and claim clients immediately for faster updates
          skipWaiting: true,
          clientsClaim: true,
          // Clean up old caches on activation
          cleanupOutdatedCaches: true,
        },
        // PWA manifest configuration
        manifest: {
          name: "Kids Call Home",
          short_name: "KidsCallHome",
          description:
            "Stay connected with your family through simple video calls and messaging",
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
        // Disable dev options in production
        devOptions: {
          enabled: mode === "development",
          type: "module",
          // Suppress workbox logs in development by disabling precaching
          // This prevents workbox from trying to precache source files
          navigateFallback: undefined, // Don't use navigation fallback in dev
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
    },
    // Inject app version as environment variable
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      // Remove console statements in production builds
      minify: "esbuild",
      terserOptions: undefined, // Use esbuild minification
      // Configure esbuild to drop console statements in production
      esbuild: {
        drop: mode === "production" ? ["console", "debugger"] : [],
      },
      // Vendor chunk splitting for weak network conditions (LTE/2G)
      // This separates rarely-changing vendor code from frequently-updated application code,
      // optimizing caching and reducing download size on slow networks.
      // Vendor chunks can be cached indefinitely since they rarely change,
      // while app code chunks are smaller and update more frequently.
      rollupOptions: {
        output: {
          manualChunks: {
            // React core libraries - rarely change, can be cached long-term
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            // TanStack Query - data fetching library, stable API
            "query-vendor": ["@tanstack/react-query"],
            // Supabase client - database and auth, stable SDK
            "supabase-vendor": ["@supabase/supabase-js"],
            // Capacitor native mobile APIs - rarely change
            // Note: @capacitor/android is native-only and not bundled for web
            "capacitor-vendor": [
              "@capacitor/core",
              "@capacitor/app",
              "@capacitor/device",
              "@capacitor/haptics",
              "@capacitor/keyboard",
              "@capacitor/local-notifications",
              "@capacitor/push-notifications",
              "@capacitor/splash-screen",
              "@capacitor/status-bar",
            ],
            // Radix UI components - all used UI primitives, stable component library
            "radix-vendor": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-aspect-ratio",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
            ],
          },
        },
      },
      // Keep chunk size warning limit at 600 KB to monitor bundle health
      chunkSizeWarningLimit: 600,
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
