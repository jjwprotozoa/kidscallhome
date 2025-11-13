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
        // Get the base URL from environment variable
        // Vercel provides VERCEL_URL for preview deployments
        // For ngrok testing, set VITE_BASE_URL=https://your-ngrok-url.ngrok-free.app
        // For production, it will use www.kidscallhome.com
        // Priority: VITE_BASE_URL > VERCEL_URL > production domain > localhost
        const baseUrl = process.env.VITE_BASE_URL || 
                       (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                       (mode === "production" ? "https://www.kidscallhome.com" : "http://localhost:8080");
        return html.replace(/\{\{OG_IMAGE_URL\}\}/g, `${baseUrl}/og-image.png`);
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
      // Allow ngrok hosts for iPhone testing
      allowedHosts: [
        ".ngrok-free.app",
        ".ngrok.app",
        ".ngrok.io",
      ],
    },
    plugins: [
      react(), 
      htmlPlugin(),
      mode === "development" && componentTagger()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
