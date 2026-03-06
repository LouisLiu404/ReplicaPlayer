const { renderer } = require("./webpack.rules");

module.exports = {
  devtool: process.env.NODE_ENV === "development" ? "inline-source-map" : false,
  output: {
    filename: "[name].js",
    chunkFilename: "[name].chunk.js"
  },
  module: {
    rules: [
      ...renderer,
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"]
  }
};
