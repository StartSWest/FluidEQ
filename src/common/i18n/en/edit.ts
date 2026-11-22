/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Editing text: a field's right-click menu (`main/editContextMenu.ts`) and
 * the Paste button beside a box whose text is meant to be pasted in
 * (`PasteButton`).
 */

const edit = {
  'edit.menu.undo': 'Undo',
  'edit.menu.redo': 'Redo',
  'edit.menu.cut': 'Cut',
  'edit.menu.copy': 'Copy',
  'edit.menu.paste': 'Paste',
  'edit.menu.pastePlain': 'Paste as plain text',
  'edit.menu.selectAll': 'Select all',
  'edit.paste.button': 'Paste',
  'edit.paste.hint': 'Paste the text you copied where the cursor is',
  'edit.paste.empty': 'There is no text on the clipboard to paste.',
  'edit.paste.failed': 'The clipboard couldn’t be read.',
} as const;

export default edit;
