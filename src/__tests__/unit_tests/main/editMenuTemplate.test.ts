/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A text field's right-click menu (`main/editMenuTemplate.ts`): every edit
 * a field can take, each enabled from what Chromium says the field can do
 * at that moment, and nothing at all where there is nothing to edit or copy
 * — a right-click there belongs to the page.
 */

import type { EditFlags, MenuItemConstructorOptions } from 'electron';
import { loadLocale, translate, type TranslationKey } from 'common/i18n';
import {
  editMenuTemplate,
  type IEditMenuActions,
  type TEditMenuParams,
} from 'main/editMenuTemplate';

const ALL: EditFlags = {
  canUndo: true,
  canRedo: true,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canSelectAll: true,
  canDelete: true,
  canEditRichly: false,
};

const NONE: EditFlags = {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  canSelectAll: false,
  canDelete: false,
  canEditRichly: false,
};

/** A right-click in a textarea, unless told otherwise. */
const params = (over: Partial<TEditMenuParams> = {}): TEditMenuParams => ({
  isEditable: true,
  selectionText: '',
  editFlags: ALL,
  misspelledWord: '',
  dictionarySuggestions: [],
  formControlType: 'text-area',
  ...over,
});

const actions = (): jest.Mocked<Required<IEditMenuActions>> => ({
  undo: jest.fn(),
  redo: jest.fn(),
  cut: jest.fn(),
  copy: jest.fn(),
  paste: jest.fn(),
  pasteAndMatchStyle: jest.fn(),
  selectAll: jest.fn(),
  replaceMisspelling: jest.fn(),
  inspect: jest.fn(),
});

const english = (key: TranslationKey) => translate('en', key);

const build = (
  over: Partial<TEditMenuParams> = {},
  act: IEditMenuActions = { ...actions(), inspect: undefined },
  platform: NodeJS.Platform = 'win32',
) => editMenuTemplate(params(over), act, english, platform);

/** Each item as its label, a separator as `-`. */
const shape = (items: MenuItemConstructorOptions[]) =>
  items.map((item) => (item.type === 'separator' ? '-' : item.label));

const item = (items: MenuItemConstructorOptions[], label: string) => {
  const found = items.find((candidate) => candidate.label === label);
  if (!found) {
    throw new Error(`no item called ${label}`);
  }
  return found;
};

const press = (entry: MenuItemConstructorOptions) =>
  (entry.click as () => void)();

describe('a text field’s right-click menu', () => {
  beforeAll(() => loadLocale('es'));

  it('offers Undo and Redo, Cut, Copy and Paste, and Select all', () => {
    expect(shape(build())).toEqual([
      'Undo',
      'Redo',
      '-',
      'Cut',
      'Copy',
      'Paste',
      '-',
      'Select all',
    ]);
  });

  it('enables each item from what the field can do right now', () => {
    const everything = build({ editFlags: ALL });
    const nothing = build({ editFlags: NONE });
    ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select all'].forEach((label) => {
      expect(item(everything, label).enabled).toBe(true);
      expect(item(nothing, label).enabled).toBe(false);
    });

    // A field with text but nothing selected: no Cut, no Copy, the rest on.
    const unselected = build({
      editFlags: { ...ALL, canCut: false, canCopy: false, canRedo: false },
    });
    expect(item(unselected, 'Cut').enabled).toBe(false);
    expect(item(unselected, 'Copy').enabled).toBe(false);
    expect(item(unselected, 'Redo').enabled).toBe(false);
    expect(item(unselected, 'Undo').enabled).toBe(true);
    expect(item(unselected, 'Paste').enabled).toBe(true);
  });

  it('does what each item says on the page that was clicked', () => {
    const act = actions();
    const menu = build({}, act);
    press(item(menu, 'Undo'));
    press(item(menu, 'Redo'));
    press(item(menu, 'Cut'));
    press(item(menu, 'Copy'));
    press(item(menu, 'Paste'));
    press(item(menu, 'Select all'));
    expect(act.undo).toHaveBeenCalledTimes(1);
    expect(act.redo).toHaveBeenCalledTimes(1);
    expect(act.cut).toHaveBeenCalledTimes(1);
    expect(act.copy).toHaveBeenCalledTimes(1);
    expect(act.paste).toHaveBeenCalledTimes(1);
    expect(act.selectAll).toHaveBeenCalledTimes(1);
  });

  it('shows the keys as hints without taking them from the page', () => {
    const menu = build();
    expect(item(menu, 'Paste').accelerator).toBe('CmdOrCtrl+V');
    expect(item(menu, 'Redo').accelerator).toBe('Ctrl+Y');
    expect(item(build({}, undefined, 'darwin'), 'Redo').accelerator).toBe(
      'Shift+Command+Z',
    );
    menu
      .filter((entry) => entry.type !== 'separator')
      .forEach((entry) => expect(entry.registerAccelerator).toBe(false));
  });

  it('speaks the window’s language', () => {
    const spanish = editMenuTemplate(
      params(),
      { ...actions(), inspect: undefined },
      (key) => translate('es', key),
      'win32',
    );
    expect(shape(spanish)).toContain('Pegar');
    expect(shape(spanish)).toContain('Deshacer');
  });

  it('opens nothing on a right-click with nothing to edit or copy', () => {
    expect(build({ isEditable: false, formControlType: 'none' })).toEqual([]);
    // Whitespace alone is not something anybody right-clicks to copy.
    expect(
      build({ isEditable: false, formControlType: 'none', selectionText: ' ' }),
    ).toEqual([]);
  });

  it('offers Copy alone for text selected on the page', () => {
    const act = actions();
    const menu = build(
      { isEditable: false, formControlType: 'none', selectionText: 'Pop' },
      // A release build: no Inspect element after it.
      { ...act, inspect: undefined },
    );
    expect(shape(menu)).toEqual(['Copy']);
    press(item(menu, 'Copy'));
    expect(act.copy).toHaveBeenCalledTimes(1);
  });

  it('leads with spelling suggestions when Chromium has some', () => {
    const act = actions();
    const menu = build(
      {
        misspelledWord: 'lyrcs',
        dictionarySuggestions: ['lyrics', 'lyric'],
      },
      act,
    );
    expect(shape(menu).slice(0, 4)).toEqual(['lyrics', 'lyric', '-', 'Undo']);
    press(item(menu, 'lyrics'));
    expect(act.replaceMisspelling).toHaveBeenCalledWith('lyrics');
  });

  it('offers a plain-text paste only to a rich editor', () => {
    expect(shape(build())).not.toContain('Paste as plain text');
    expect(shape(build({ formControlType: 'input-text' }))).not.toContain(
      'Paste as plain text',
    );

    const act = actions();
    const rich = build({ formControlType: 'none' }, act);
    expect(shape(rich)).toContain('Paste as plain text');
    press(item(rich, 'Paste as plain text'));
    expect(act.pasteAndMatchStyle).toHaveBeenCalledTimes(1);
  });

  it('adds development’s Inspect element to the same menu, and alone where there is nothing to edit', () => {
    const act = actions();
    const menu = build({}, act);
    expect(shape(menu).slice(-2)).toEqual(['-', 'Inspect element']);
    press(item(menu, 'Inspect element'));
    expect(act.inspect).toHaveBeenCalledTimes(1);

    expect(
      shape(build({ isEditable: false, formControlType: 'none' }, act)),
    ).toEqual(['Inspect element']);
  });
});
