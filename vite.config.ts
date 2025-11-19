import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Plugin to inject OG image URL based on environment
  const htmlPlugin = () => {
    return {
      name: "html-transform",
      transformIndexHtml(html: string, ctx) {
        // For Open Graph images, always use the production domain
        // This ensures social media shares always show the correct image URL
        // regardless of whether it's a preview or production deployment
        const ogImageUrl = process.env.VITE_BASE_URL 
          ? `${process.env.VITE_BASE_URL}/og-image.png`
          : "https://www.kidscallhome.com/og-image.png";
        
        return html.replace(/\{\{OG_IMAGE_URL\}\}/g, ogImageUrl);
      },
    };
  };

  // Plugin to remove console logs in production builds (security best practice)
  const removeConsolePlugin = () => {
    return {
      name: "remove-console",
      transform(code: string, id: string) {
        // Only remove console logs in production builds
        const isSourceFile = id.endsWith(".ts") || id.endsWith(".tsx") || id.endsWith(".js") || id.endsWith(".jsx");
        // Skip node_modules files
        if (mode === "production" && isSourceFile && !id.includes("node_modules")) {
          // Remove console.log, console.debug, console.info
          // Keep console.warn and console.error for critical errors
          // Use a more careful regex that handles multi-line and template literals
          let transformed = code;
          
          // Remove single-line console.log statements
          transformed = transformed.replace(/console\.log\([^;]*?\);?\s*/g, "");
          transformed = transformed.replace(/console\.debug\([^;]*?\);?\s*/g, "");
          transformed = transformed.replace(/console\.info\([^;]*?\);?\s*/g, "");
          
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
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
  };
});
