// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4746",
        changeOrigin: true,
        ws: true,
      },
      "/ws": {
        target: "http://localhost:4746",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
