/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene's notes in the Code tab (Ivan, 2026-11-11: "shall we allow to
 * edit all files? notes at least yes"): two plain fields with real line
 * breaks, a draft written only by Save through the notes' own writer, the
 * raw file one press away, and nothing editable in a scene opened to look
 * inside.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IProjectCodeFile } from '../../../main/memberScenes/projectCode';
import StudioCodeNotes, {
  notesTextOf,
  notesToSave,
} from '../../../renderer/studio/StudioCodeNotes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const saveStudioNotes = jest.fn();

const notesFile = (
  description: string,
  whatsNew?: string,
): IProjectCodeFile => {
  const text = JSON.stringify(
    { schema: 1, description, ...(whatsNew ? { whatsNew } : {}) },
    null,
    2,
  );
  return { file: 'studio-notes.json', role: 'notes', bytes: text.length, text };
};

const notes = (
  file: IProjectCodeFile,
  { editable = true, onSaved = jest.fn() } = {},
) => (
  <StudioCodeNotes
    projectId="lake"
    file={file}
    open
    onToggle={jest.fn()}
    editable={editable}
    onSaved={onSaved}
  />
);

const description = () =>
  screen.getByRole('textbox', { name: /studio\.notes\.description/ });
const whatsNew = () =>
  screen.getByRole('textbox', { name: /studio\.notes\.whatsNew/ });

beforeEach(() => {
  jest.clearAllMocks();
  saveStudioNotes.mockResolvedValue(true);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { saveStudioNotes } },
  });
});

describe('the notes as fields', () => {
  it('shows the description with its real line breaks, not the JSON', () => {
    render(
      notes(notesFile('A lake at night.\nA boat drifts.', 'Calmer water')),
    );
    expect(description()).toHaveValue('A lake at night.\nA boat drifts.');
    expect(whatsNew()).toHaveValue('Calmer water');
    expect(screen.queryByText(/\\n/)).not.toBeInTheDocument();
  });

  it('writes nothing until Save, and then through the notes’ own writer', async () => {
    const onSaved = jest.fn();
    render(notes(notesFile('A lake'), { onSaved }));
    expect(
      screen.queryByRole('button', { name: 'studio.edit.save' }),
    ).not.toBeInTheDocument();
    fireEvent.change(description(), { target: { value: 'A lake\nat dawn' } });
    fireEvent.change(whatsNew(), { target: { value: '  Morning   light ' } });
    expect(saveStudioNotes).not.toHaveBeenCalled();
    expect(screen.getByText('studio.notes.unsaved')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'studio.edit.save' }));
    });
    expect(saveStudioNotes).toHaveBeenCalledWith('lake', {
      description: 'A lake\nat dawn',
      whatsNew: 'Morning light',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('forgets the draft on Discard, and the notes are as they were', () => {
    render(notes(notesFile('A lake')));
    fireEvent.change(description(), { target: { value: 'Something else' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.edit.discard' }),
    );
    expect(description()).toHaveValue('A lake');
    expect(saveStudioNotes).not.toHaveBeenCalled();
  });

  it('keeps the draft and says so when the save fails', async () => {
    saveStudioNotes.mockResolvedValue(false);
    render(notes(notesFile('A lake')));
    fireEvent.change(description(), { target: { value: 'Mine' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'studio.edit.save' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.notes.saveFailed',
    );
    expect(description()).toHaveValue('Mine');
  });

  it('says when the file changed under the typing, and keeps the typing', () => {
    const { rerender } = render(notes(notesFile('A lake')));
    fireEvent.change(description(), { target: { value: 'Mine' } });
    rerender(notes(notesFile('Written by the AI')));
    expect(description()).toHaveValue('Mine');
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.notes.changedOutside',
    );
  });

  it('shows the file itself on request', () => {
    render(notes(notesFile('A lake')));
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.notes.showFile' }),
    );
    expect(
      screen.getByRole('textbox', {
        name: 'studio.code.label:studio-notes.json',
      }),
    ).toHaveValue(notesFile('A lake').text);
  });
});

describe('a scene opened to look inside', () => {
  it('shows its notes and offers nothing that would change them', () => {
    render(notes(notesFile('FluidEQ’s own'), { editable: false }));
    expect(description()).toHaveAttribute('readonly');
    expect(whatsNew()).toHaveAttribute('readonly');
    fireEvent.change(description(), { target: { value: 'changed' } });
    expect(
      screen.queryByRole('button', { name: 'studio.edit.save' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('studio.code.viewOnly')).toBeInTheDocument();
  });
});

describe('notes that cannot be read as notes', () => {
  it('are shown as the file and never offered as fields', () => {
    const broken: IProjectCodeFile = {
      file: 'studio-notes.json',
      role: 'notes',
      bytes: 9,
      text: '{ "desc',
    };
    expect(notesTextOf(broken.text)).toBeUndefined();
    render(notes(broken));
    expect(
      screen.queryByRole('textbox', { name: /studio\.notes\.description/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('studio.code.viewOnly')).toBeInTheDocument();
  });

  it('take no empty line as a What’s new', () => {
    expect(notesToSave({ description: 'x', whatsNew: '   ' })).toEqual({
      description: 'x',
    });
  });
});
