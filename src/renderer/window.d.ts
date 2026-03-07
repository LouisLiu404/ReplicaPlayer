import type { LibraryApi, SystemApi } from "../shared/types";

declare global {
  interface Window {
    library: LibraryApi;
    system: SystemApi;
  }
}

export {};
