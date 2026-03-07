import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Renderer root element was not found");
}

const appTree = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

createRoot(rootElement).render(
  process.env.NODE_ENV === "development"
    ? <StrictMode>{appTree}</StrictMode>
    : appTree
);
