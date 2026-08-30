import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";
import { developmentProxy } from "./developmentProxy.ts";

export default defineConfig({
  plugins: [agents(), react(), cloudflare(), tailwindcss()],
  server: {
    proxy: developmentProxy,
  },
});
