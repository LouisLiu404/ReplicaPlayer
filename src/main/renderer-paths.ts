import path from "node:path";

export const PRODUCTION_RENDERER_ORIGIN = "app://renderer";
export const PRODUCTION_RENDERER_ENTRY_PATH = "/main_window/index.html";

export function getProductionRendererEntryUrl(): string {
  return `${PRODUCTION_RENDERER_ORIGIN}${PRODUCTION_RENDERER_ENTRY_PATH}`;
}

export function getProductionRendererRoot(mainDir: string): string {
  return path.resolve(mainDir, "../renderer");
}

export function normalizeProductionRendererRequestPath(requestPath: string): string {
  return requestPath === "/" ? PRODUCTION_RENDERER_ENTRY_PATH : requestPath;
}
