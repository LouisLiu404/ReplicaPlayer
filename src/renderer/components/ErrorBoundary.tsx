import type { ReactNode } from "react";
import { Component } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("Renderer error boundary caught an error", error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="renderer-error-boundary" role="alert">
          <div className="renderer-error-boundary-copy">
            <p className="section-kicker">Renderer Error</p>
            <h1>Something went wrong</h1>
            <p>Replica Player hit an unexpected UI error. Restart the app and try again.</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
