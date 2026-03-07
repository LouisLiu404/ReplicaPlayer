// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

function ThrowingChild() {
  throw new Error("boom");
  return null;
}

describe("ErrorBoundary", () => {
  it("renders a recovery message when a child throws", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert").textContent).toContain("Something went wrong");

    consoleErrorSpy.mockRestore();
  });
});
