import { Component } from 'react';

/** Shows a readable message instead of a blank white screen when a component crashes. */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('UI crash:', error, info && info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl" aria-hidden="true">🛠️</div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-slate-600">{String(this.state.error.message || this.state.error)}</p>
        <button className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white" onClick={() => window.location.assign('/')}>Back to home</button>
      </div>
    );
  }
}
