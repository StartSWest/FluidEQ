/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Paste button's two questions to main (`main/ipc/clipboardText.ts`).
 *
 * Whether the clipboard holds text is asked whenever the window comes
 * forward, and answered from the formats on it alone: none of the text
 * crosses, so a window that asks every time it is focused is never reading
 * what the listener copied elsewhere. The text itself crosses only on the
 * press of a Paste button.
 */
export const CLIPBOARD_HAS_TEXT = 'clipboard-has-text';
export const CLIPBOARD_READ_TEXT = 'clipboard-read-text';
