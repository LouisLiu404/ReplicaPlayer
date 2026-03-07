const path = require("node:path");
const { MakerZIP } = require("@electron-forge/maker-zip");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");
const { generateMacIcon } = require("./scripts/generate-macos-icon");

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "Replica Player",
    icon: path.resolve(__dirname, "build/app-icon.icns")
  },
  hooks: {
    generateAssets: async () => {
      generateMacIcon();
    }
  },
  makers: [new MakerZIP({}, ["darwin"])],
  plugins: [
    new WebpackPlugin({
      devContentSecurityPolicy:
        "default-src 'self'; img-src 'self' replica-media: data: app: blob:; media-src 'self' replica-media: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' replica-media: app: ws: http: https:;",
      mainConfig: "./webpack.main.config.js",
      renderer: {
        config: "./webpack.renderer.config.js",
        entryPoints: [
          {
            html: "./src/index.html",
            js: "./src/renderer/index.tsx",
            name: "main_window",
            preload: {
              js: "./src/preload.ts"
            }
          }
        ]
      }
    })
  ]
};
