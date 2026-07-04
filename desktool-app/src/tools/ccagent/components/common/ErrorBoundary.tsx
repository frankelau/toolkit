// ErrorBoundary — React 错误边界，捕获子组件渲染异常

import { Component, type ReactNode, type ErrorInfo } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义 fallback */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 错误回调 */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="cc-error-boundary">
          <div className="cc-error-boundary-icon">⚠️</div>
          <div className="cc-error-boundary-title">组件渲染失败</div>
          <pre className="cc-error-boundary-msg">{this.state.error.message}</pre>
          <button className="cc-error-boundary-reset" onClick={this.reset}>重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}
