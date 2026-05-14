// SPDX-License-Identifier: Apache-2.0
import { css } from 'lit';

export const modelEditorStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: var(--openfga-model-editor-min-height, 320px);
    background: var(--openfga-editor-bg, #1e1e2e);
    font-family: var(--openfga-font-family);
    font-size: var(--openfga-font-size-base, 14px);
    color: var(--openfga-text-primary, #cdd6f4);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--openfga-space-sm, 8px);
    padding: var(--openfga-space-xs, 4px) var(--openfga-space-sm, 8px);
    background: var(--openfga-bg-secondary, #181825);
    border-bottom: 1px solid var(--openfga-border, #45475a);
    flex-shrink: 0;
  }

  .format-toggle {
    display: flex;
    gap: var(--openfga-space-xs, 4px);
  }

  .format-btn {
    padding: 2px var(--openfga-space-sm, 8px);
    border: 1px solid var(--openfga-border, #45475a);
    border-radius: var(--openfga-radius-sm, 4px);
    background: transparent;
    color: var(--openfga-text-secondary, #a6adc8);
    font-size: var(--openfga-font-size-sm, 12px);
    cursor: pointer;
    transition: background var(--openfga-transition-fast, 100ms ease),
      color var(--openfga-transition-fast, 100ms ease);
  }

  .format-btn:hover {
    background: var(--openfga-bg-elevated, #313244);
    color: var(--openfga-text-primary, #cdd6f4);
  }

  .format-btn[aria-pressed='true'] {
    background: var(--openfga-accent, #89b4fa);
    color: var(--openfga-accent-text, #1e1e2e);
    border-color: var(--openfga-accent, #89b4fa);
  }

  .format-btn:focus-visible {
    outline: 2px solid var(--openfga-accent, #89b4fa);
    outline-offset: 2px;
  }

  .editor-container {
    flex: 1;
    min-height: var(--openfga-model-editor-viewport-min-height, 220px);
    position: relative;
  }

  /* Monaco mounts here; it must fill the container */
  .monaco-host {
    position: absolute;
    inset: 0;
  }

  /* Overflow widgets (hover tooltips, completion details) are redirected into
     this container so they remain inside the shadow root and can be styled by
     Monaco's CSS (which is also injected into the shadow root).
     position:fixed at the viewport origin so Monaco's viewport-absolute
     coordinates (top: <viewport-px>) map correctly. Zero-sized with
     overflow:visible so the widgets don't affect layout. */
  .monaco-overflow-widgets-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    overflow: visible;
    pointer-events: none;
    z-index: 9999;
  }
  .monaco-overflow-widgets-container > * {
    pointer-events: auto;
  }

  .error-panel {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--openfga-space-xs, 4px) var(--openfga-space-sm, 8px);
    background: var(--openfga-bg-secondary, #181825);
    border-top: 1px solid var(--openfga-border, #45475a);
    max-height: 120px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .error-item {
    display: flex;
    align-items: baseline;
    gap: var(--openfga-space-sm, 8px);
    font-size: var(--openfga-font-size-sm, 12px);
    font-family: var(--openfga-font-mono);
    color: var(--openfga-error, #f38ba8);
  }

  .error-location {
    color: var(--openfga-text-secondary, #a6adc8);
    white-space: nowrap;
  }

  .error-message {
    word-break: break-word;
  }

  .error-badge {
    padding: 1px 6px;
    border-radius: var(--openfga-radius-sm, 4px);
    background: var(--openfga-error, #f38ba8);
    color: var(--openfga-bg-primary, #1e1e2e);
    font-size: var(--openfga-font-size-sm, 12px);
    font-weight: 600;
  }
`;
