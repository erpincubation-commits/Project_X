import React from 'react';

export function reportRendererError(kind: 'render' | 'script' | 'promise' | 'action') {
  // Report only a category. Error messages may contain customer data or credentials.
  void window.erp?.reportError(kind).catch(() => undefined);
}
export class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { reportRendererError('render'); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert"><h1>The workspace could not be displayed</h1><p>Reload the window to reconnect. If the problem continues, share the diagnostic log with your administrator.</p><button onClick={() => window.location.reload()}>Reload workspace</button> <button onClick={() => void window.erp?.openLogs()}>Open diagnostic logs</button></main>;
  }
}
