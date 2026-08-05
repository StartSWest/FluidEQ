/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Component, ErrorInfo, ReactNode } from 'react';
import { reportError } from './utils/logger';
import './styles/ErrorBoundary.scss';

interface IErrorBoundaryProps {
  children: ReactNode;
}

interface IErrorBoundaryState {
  error?: Error;
  componentStack?: string;
}

/**
 * Stops one bad render from taking the whole window with it.
 *
 * React unmounts the entire tree when a render throws, and with nothing to
 * catch it the window goes completely blank — no equalizer, no titlebar, no
 * clue what happened. That is not a hypothetical: any access to
 * `window.electron` when the preload script has failed to load throws exactly
 * that way, and the symptom is an app that looks like it never started.
 *
 * A blank window is the worst possible failure because it is also the least
 * diagnosable. This shows what broke and offers a reload instead.
 */
export default class ErrorBoundary extends Component<
  IErrorBoundaryProps,
  IErrorBoundaryState
> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // To the console for a developer, and to the log file for everyone else.
    // This used to be the console alone, which meant the app's single most
    // serious failure — the one that replaces the whole window — left no trace
    // in the file a bug report attaches.
    reportError(
      `Crashed while rendering${info.componentStack ? `\n${info.componentStack.trim()}` : ''}`,
      error,
    );
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render() {
    const { error, componentStack } = this.state;
    const { children } = this.props;

    if (!error) {
      return children;
    }

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-screen__card">
          <p className="eyebrow">SOMETHING BROKE</p>
          <h1>FluidEQ hit an error while drawing the window</h1>
          <p className="crash-screen__lead">
            Your audio is unaffected — Equalizer APO keeps applying the last
            settings FluidEQ wrote, whatever happens in here.
          </p>

          <pre className="crash-screen__detail">
            {error.message || String(error)}
            {componentStack ? `\n${componentStack.trim()}` : ''}
          </pre>

          <div className="crash-screen__actions">
            <button
              type="button"
              className="crash-screen__action crash-screen__action--primary"
              onClick={() => window.location.reload()}
            >
              Reload FluidEQ
            </button>
            <button
              type="button"
              className="crash-screen__action"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(
                    `${error.message}\n${error.stack ?? ''}\n${componentStack ?? ''}`,
                  )
                  .catch(() => undefined);
              }}
            >
              Copy details
            </button>
          </div>
        </div>
      </div>
    );
  }
}
