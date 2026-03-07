import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getProductionRendererEntryUrl,
  getProductionRendererRoot,
  normalizeProductionRendererRequestPath,
  PRODUCTION_RENDERER_ENTRY_PATH
} from "./renderer-paths";

describe("renderer packaging paths", () => {
  it("aligns the production entry URL with the packaged renderer directory", () => {
    const mainDir = path.join("/tmp", "app.asar", ".webpack", "main");
    const rendererRoot = getProductionRendererRoot(mainDir);
    const entryPath = normalizeProductionRendererRequestPath(new URL(getProductionRendererEntryUrl()).pathname);

    expect(getProductionRendererEntryUrl()).toBe("app://renderer/main_window/index.html");
    expect(rendererRoot).toBe(path.join("/tmp", "app.asar", ".webpack", "renderer"));
    expect(path.resolve(rendererRoot, `.${entryPath}`)).toBe(
      path.join("/tmp", "app.asar", ".webpack", "renderer", "main_window", "index.html")
    );
    expect(path.resolve(rendererRoot, "./main_window/index.js")).toBe(
      path.join("/tmp", "app.asar", ".webpack", "renderer", "main_window", "index.js")
    );
  });

  it("rewrites the app root request to the packaged entry path", () => {
    expect(normalizeProductionRendererRequestPath("/")).toBe(PRODUCTION_RENDERER_ENTRY_PATH);
    expect(normalizeProductionRendererRequestPath("/main_window/preload.js")).toBe("/main_window/preload.js");
  });
});
