const typescriptRule = {
  test: /\.tsx?$/,
  exclude: /(node_modules|\.webpack)/,
  use: {
    loader: "ts-loader",
    options: {
      transpileOnly: true
    }
  }
};

module.exports = {
  main: [
    {
      test: /native_modules[/\\].+\.node$/,
      use: "node-loader"
    },
    {
      test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
      parser: { amd: false },
      use: {
        loader: "@vercel/webpack-asset-relocator-loader",
        options: {
          outputAssetBase: "native_modules"
        }
      }
    },
    typescriptRule
  ],
  renderer: [typescriptRule]
};
