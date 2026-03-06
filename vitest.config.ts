import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "music-metadata/lib/index.js": path.resolve(__dirname, "node_modules/music-metadata/lib/index.js"),
      "music-metadata/lib/type.js": path.resolve(__dirname, "node_modules/music-metadata/lib/type.js")
    }
  },
  test: {
    environment: "node"
  }
});
