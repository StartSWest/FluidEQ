/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron';
import type { TranslationKey } from '../common/i18n';

/** What the menu's items do, on the page that was right-clicked. */
export interface IEditMenuActions {
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  pasteAndMatchStyle: () => void;
  selectAll: () => void;
  replaceMisspelling: (word: string) => void;
  /** Development only: the developer tools, on the element under the click. */
  inspect?: () => void;
}

/** The part of Electron's report the menu is built from. */
export type TEditMenuParams = Pick<
  ContextMenuParams,
  | 'isEditable'
  | 'selectionText'
  | 'editFlags'
  | 'misspelledWord'
  | 'dictionarySuggestions'
  | 'formControlType'
>;

/**
 * Only a rich editor (a `contenteditable`) can be handed styled text, so it
 * alone is offered a paste that drops the styling: Electron reports one as
 * editable with no form control. In an input or a textarea every paste is
 * already plain, and the item would be a second Paste.
 */
const isRichEditor = (params: TEditMenuParams) =>
  params.isEditable && params.formControlType === 'none';

/**
 * The right-click menu of a text field, or of text selected on the page:
 * Undo, Redo, Cut, Copy, Paste, Select all — each enabled from what Chromium
 * says the field can do at that moment (`editFlags`), so a field with nothing
 * selected offers no Cut. Spelling suggestions lead when Chromium has any.
 *
 * Empty when there is nothing to edit or copy, and then no menu opens: a
 * right-click on a band, a row or a canvas is the page's own business. A
 * page that draws its own menu calls `preventDefault` on `contextmenu`, and
 * Chromium then never reports the click to Electron at all, so the band and
 * Library menus are untouched by construction.
 *
 * The accelerators are hints, never registered: the keys already work in
 * every field without the menu, and registering them here would take them
 * from the page.
 */
export const editMenuTemplate = (
  params: TEditMenuParams,
  actions: IEditMenuActions,
  label: (key: TranslationKey) => string,
  platform: NodeJS.Platform,
): MenuItemConstructorOptions[] => {
  const flags = params.editFlags;
  const items: MenuItemConstructorOptions[] = [];
  const hint = (accelerator: string) => ({
    accelerator,
    registerAccelerator: false,
  });

  if (
    params.isEditable &&
    params.misspelledWord !== '' &&
    params.dictionarySuggestions.length > 0
  ) {
    params.dictionarySuggestions.forEach((word) => {
      items.push({
        label: word,
        click: () => actions.replaceMisspelling(word),
      });
    });
    items.push({ type: 'separator' });
  }

  if (params.isEditable) {
    items.push(
      {
        label: label('edit.menu.undo'),
        enabled: flags.canUndo,
        click: actions.undo,
        ...hint('CmdOrCtrl+Z'),
      },
      {
        label: label('edit.menu.redo'),
        enabled: flags.canRedo,
        click: actions.redo,
        ...hint(platform === 'darwin' ? 'Shift+Command+Z' : 'Ctrl+Y'),
      },
      { type: 'separator' },
      {
        label: label('edit.menu.cut'),
        enabled: flags.canCut,
        click: actions.cut,
        ...hint('CmdOrCtrl+X'),
      },
      {
        label: label('edit.menu.copy'),
        enabled: flags.canCopy,
        click: actions.copy,
        ...hint('CmdOrCtrl+C'),
      },
      {
        label: label('edit.menu.paste'),
        enabled: flags.canPaste,
        click: actions.paste,
        ...hint('CmdOrCtrl+V'),
      },
    );
    if (isRichEditor(params)) {
      items.push({
        label: label('edit.menu.pastePlain'),
        enabled: flags.canPaste,
        click: actions.pasteAndMatchStyle,
        ...hint('CmdOrCtrl+Shift+V'),
      });
    }
    items.push(
      { type: 'separator' },
      {
        label: label('edit.menu.selectAll'),
        enabled: flags.canSelectAll,
        click: actions.selectAll,
        ...hint('CmdOrCtrl+A'),
      },
    );
  } else if (params.selectionText.trim() !== '') {
    items.push({
      label: label('edit.menu.copy'),
      enabled: flags.canCopy,
      click: actions.copy,
      ...hint('CmdOrCtrl+C'),
    });
  }

  if (actions.inspect !== undefined) {
    if (items.length > 0) {
      items.push({ type: 'separator' });
    }
    // Development tooling, never in a release: English like the rest of the
    // development menu.
    items.push({ label: 'Inspect element', click: actions.inspect });
  }

  return items;
};
