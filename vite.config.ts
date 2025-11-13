import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
