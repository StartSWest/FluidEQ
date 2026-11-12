/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Editing the scene's files in the Code tab (the mockup Ivan approved on
 * 2026-11-11): a draft with Undo, Redo and Discard, never saved by itself;
 * checked as it is typed by the rules every save goes through, held back
 * with its reason and its line in red when it fails, played on the stage
 * when it passes; and never offered on a scene that is not the member's.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import type { IProjectSource } from '../../../main/memberScenes/project';
import type { IProjectCodeFile } from '../../../main/memberScenes/projectCode';
import StudioCode from '../../../renderer/studio/StudioCode';
import { useCodeDraft } from '../../../renderer/studio/codeDraftStore';
import {
  canRedo,
  canUndo,
  recordText,
  redo,
  shownText,
  startHistory,
  undo,
} from '../../../renderer/studio/codeHistory';
import { resetStudioStore } from '../../../renderer/studio/studioStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const writeStudioCode = jest.fn();
const checkStudioCode = jest.fn();
const readStudioProjectCode = jest.fn();

const BEFORE = ['void main() {', '  float a = 1.0;', '}'].join('\n');
const AFTER = ['void main() {', '  float a = 2.0;', '}'].join('\n');
const WORLD = ['{', '  "vars": {}', '}'].join('\n');

const source = (text: string): IProjectSource => ({ file: 'scene.frag', text });
const PACK = { id: 'drafted' } as unknown as IScenePack;

const editor = (file = 'scene.frag') =>
  screen.getByRole('textbox', { name: `studio.code.label:${file}` });
const button = (name: string) => screen.getByRole('button', { name });
const status = () => screen.getByRole('status');

const show = async (props: Partial<Parameters<typeof StudioCode>[0]> = {}) => {
  const view = render(
    <StudioCode
      projectId="one"
      source={source(BEFORE)}
      problemLines={[]}
      editable
      // eslint-disable-next-line react/jsx-props-no-spreading -- each case changes one prop of the tab
      {...props}
    />,
  );
  await act(async () => {});
  return view;
};

const type = async (value: string, file = 'scene.frag') => {
  fireEvent.change(editor(file), { target: { value } });
  await act(async () => {});
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  resetStudioStore();
  writeStudioCode.mockResolvedValue('written');
  checkStudioCode.mockResolvedValue({ ok: true });
  readStudioProjectCode.mockResolvedValue([]);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: { writeStudioCode, checkStudioCode, readStudioProjectCode },
    },
  });
});

describe('a draft that fails its check', () => {
  it('is held back with its reason, its line in red, and no Save', async () => {
    checkStudioCode.mockResolvedValue({
      ok: false,
      problems: [{ code: 'bad-json', line: 2 }],
    });
    const { container } = await show();
    await type(AFTER);
    expect(status()).toHaveTextContent('studio.code.problemOne');
    expect(button('studio.code.save')).toBeDisabled();
    const why = screen.getByRole('alert');
    expect(
      within(why).getByRole('button', { name: 'studio.code.atLine:2' }),
    ).toBeInTheDocument();
    expect(why).toHaveTextContent('studio.code.badJson');
    const gutter = container.querySelectorAll('.studio-code__gutter span');
    expect(gutter[1]).toHaveClass('is-wrong');
    expect(gutter[0]).not.toHaveClass('is-wrong');
    // Ctrl+S writes nothing either.
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 's', ctrlKey: true });
    });
    expect(writeStudioCode).not.toHaveBeenCalled();
  });

  it('says a reason the build gives the file as a whole without a line', async () => {
    checkStudioCode.mockResolvedValue({
      ok: false,
      problems: [{ code: 'bad-world' }],
    });
    await show();
    await type(AFTER);
    const why = screen.getByRole('alert');
    expect(why).toHaveTextContent('studio.problem.bad-world');
    expect(within(why).queryByRole('button')).not.toBeInTheDocument();
  });

  it('is held back when the stage could not compile it, in the words of the driver', async () => {
    const { rerender } = await show();
    await type(AFTER);
    expect(button('studio.code.save')).toBeEnabled();
    rerender(
      <StudioCode
        projectId="one"
        source={source(BEFORE)}
        problemLines={[]}
        compile={{ lines: [2], message: "ERROR: 0:2: 'b' : undeclared" }}
        editable
      />,
    );
    expect(button('studio.code.save')).toBeDisabled();
    expect(status()).toHaveTextContent('studio.code.noCompile');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "studio.code.compileError:ERROR: 0:2: 'b' : undeclared",
    );
  });

  it('takes only the newest check, whichever answers last', async () => {
    let answerFirst: (value: unknown) => void = () => undefined;
    checkStudioCode
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerFirst = resolve;
        }),
      )
      .mockResolvedValue({ ok: true });
    await show();
    fireEvent.change(editor(), { target: { value: `${BEFORE}\n// a` } });
    fireEvent.change(editor(), { target: { value: AFTER } });
    await act(async () => {
      answerFirst({ ok: false, problems: [{ code: 'bad-json', line: 1 }] });
    });
    expect(checkStudioCode).toHaveBeenLastCalledWith('scene.frag', AFTER);
    expect(status()).toHaveTextContent('studio.code.ready');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Undo, Redo and Discard', () => {
  it('step back and forward through the draft, from the buttons and the keys', async () => {
    await show();
    await type(AFTER);
    fireEvent.click(button('studio.code.undo'));
    expect(editor()).toHaveValue(BEFORE);
    fireEvent.click(button('studio.code.redo'));
    expect(editor()).toHaveValue(AFTER);
    fireEvent.keyDown(editor(), { key: 'z', ctrlKey: true });
    expect(editor()).toHaveValue(BEFORE);
    fireEvent.keyDown(editor(), { key: 'y', ctrlKey: true });
    expect(editor()).toHaveValue(AFTER);
    await act(async () => {});
  });

  it('puts the file back as saved, and Undo brings the draft back', async () => {
    await show();
    await type(AFTER);
    fireEvent.click(button('studio.code.discard'));
    expect(editor()).toHaveValue(BEFORE);
    expect(status()).toHaveTextContent('studio.code.watching');
    fireEvent.click(button('studio.code.undo'));
    expect(editor()).toHaveValue(AFTER);
    await act(async () => {});
  });

  it('take a word as one step, not a letter each', () => {
    let history = startHistory('a');
    ['a ', 'a b', 'a bo', 'a boa', 'a boat'].forEach((text) => {
      history = recordText(history, text);
    });
    // The whole word goes, back to the space before it.
    expect(shownText(undo(history))).toBe('a ');
    // A space starts a step of its own, and a paste is always one.
    history = recordText(history, 'a boat on the sea');
    expect(shownText(undo(history))).toBe('a boat');
    expect(canRedo(history)).toBe(false);
    expect(canRedo(undo(history))).toBe(true);
    expect(shownText(redo(undo(history)))).toBe('a boat on the sea');
    expect(canUndo(startHistory('x'))).toBe(false);
  });
});

describe('a draft that passes', () => {
  it('plays on the stage before it is saved, and stops once it is', async () => {
    checkStudioCode.mockResolvedValue({ ok: true, pack: PACK });
    const playing = renderHook(() => useCodeDraft('one'));
    await show();
    await type(AFTER);
    expect(playing.result.current?.pack).toBe(PACK);
    expect(playing.result.current?.file).toBe('scene.frag');
    // Another project is never handed this one's draft.
    expect(
      renderHook(() => useCodeDraft('two')).result.current,
    ).toBeUndefined();
    await act(async () => {
      fireEvent.click(button('studio.code.save'));
    });
    expect(writeStudioCode).toHaveBeenCalledWith('scene.frag', AFTER);
    expect(playing.result.current).toBeUndefined();
  });

  it('never plays the scene of a text already typed over', async () => {
    const OLD = { id: 'old' } as unknown as IScenePack;
    const NEW = { id: 'new' } as unknown as IScenePack;
    let answerFirst: (value: unknown) => void = () => undefined;
    let answerSecond: (value: unknown) => void = () => undefined;
    checkStudioCode
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerSecond = resolve;
        }),
      );
    const playing = renderHook(() => useCodeDraft('one'));
    await show();
    fireEvent.change(editor(), { target: { value: `${BEFORE}\n// a` } });
    fireEvent.change(editor(), { target: { value: AFTER } });
    await act(async () => {
      answerFirst({ ok: true, pack: OLD });
    });
    expect(playing.result.current).toBeUndefined();
    await act(async () => {
      answerSecond({ ok: true, pack: NEW });
    });
    expect(playing.result.current?.pack).toBe(NEW);
  });

  it('stops playing when the draft is discarded', async () => {
    checkStudioCode.mockResolvedValue({ ok: true, pack: PACK });
    const playing = renderHook(() => useCodeDraft('one'));
    await show();
    await type(AFTER);
    expect(playing.result.current?.pack).toBe(PACK);
    await act(async () => {
      fireEvent.click(button('studio.code.discard'));
    });
    expect(playing.result.current).toBeUndefined();
  });
});

describe('which files are edited', () => {
  const FILES: IProjectCodeFile[] = [
    { file: 'scene.frag', role: 'scene', bytes: 40, text: BEFORE },
    { file: 'pack.json', role: 'pack', bytes: 18, text: '{}' },
    { file: 'world.json', role: 'world', bytes: WORLD.length, text: WORLD },
  ];

  it('the world as well as the shader, saved by its own name', async () => {
    readStudioProjectCode.mockResolvedValue(FILES);
    await show();
    fireEvent.click(screen.getByRole('button', { name: /^world\.json/ }));
    expect(editor('world.json')).not.toHaveAttribute('readonly');
    await type(`${WORLD}\n`, 'world.json');
    expect(checkStudioCode).toHaveBeenCalledWith('world.json', `${WORLD}\n`);
    await act(async () => {
      fireEvent.click(button('studio.code.save'));
    });
    expect(writeStudioCode).toHaveBeenCalledWith('world.json', `${WORLD}\n`);
  });

  it('never the details file, nor anything of a scene that is not the member’s', async () => {
    readStudioProjectCode.mockResolvedValue(FILES);
    await show({ editable: false });
    fireEvent.click(screen.getByRole('button', { name: /^pack\.json/ }));
    fireEvent.click(screen.getByRole('button', { name: /^scene\.frag/ }));
    fireEvent.click(screen.getByRole('button', { name: /^world\.json/ }));
    expect(editor('pack.json')).toHaveAttribute('readonly');
    expect(editor()).toHaveAttribute('readonly');
    expect(editor('world.json')).toHaveAttribute('readonly');
    expect(
      screen.queryByRole('button', { name: 'studio.code.save' }),
    ).not.toBeInTheDocument();
  });
});
