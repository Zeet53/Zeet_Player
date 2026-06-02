import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        "electron",
        /^node:/,
        "path",
        "url",
        "module",
        "fs",
        "child_process",
        "os",
        "crypto",
        "http",
        "https",
        "stream",
        "util",
        "events",
        "buffer",
        "assert",
        "net",
        "tls",
      ],
    },
    minify: false,
    sourcemap: true,
  },
});
