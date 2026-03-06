const path = require("node:path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
  devtool: process.env.NODE_ENV === "development" ? "inline-source-map" : false,
  entry: {
    index: "./src/main/main.ts",
    "library-worker": "./src/main/library/library-worker.ts"
  },
  output: {
    filename: "[name].js",
    chunkFilename: "[name].chunk.js"
  },
  module: {
    rules: require("./webpack.rules").main
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    alias: {
      "music-metadata/lib/index.js": path.resolve(__dirname, "node_modules/music-metadata/lib/index.js"),
      "music-metadata/lib/type.js": path.resolve(__dirname, "node_modules/music-metadata/lib/type.js")
    }
  }
};
