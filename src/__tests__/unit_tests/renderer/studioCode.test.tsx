/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's Code tab: every file of the open project, each folding to
 * its name, and the scene's own code live both ways.
 *
 * What is held here is whose text wins. A save from outside — the member's
 * AI, their editor — replaces the pane's text and marks what it changed, but
 * only while nothing is typed there; typed text is the member's until they
 * save it, and an outside save arriving meanwhile is offered, never written
 * over their typing. And that the tab is the whole project: it showed the
 * shader alone (Ivan, 2026-11-11: "it needs to show the full code, all
 * files, and expand collapse on each").
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
import type { ReactElement } from 'react';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import type { IProjectSource } from '../../../main/memberScenes/project';
import type { IProjectCodeFile } from '../../../main/memberScenes/projectCode';
import StudioCode, {
  problemLinesOf,
} from '../../../renderer/studio/StudioCode';
import {
  adoptStudioStateForTesting,
  openStudioSession,
  resetStudioStore,
  useStudio,
} from '../../../renderer/studio/studioStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const writeStudioSource = jest.fn();
const readStudioProjectCode = jest.fn();

const source = (text: string): IProjectSource => ({ file: 'scene.frag', text });

const BEFORE = ['void main() {', '  float a = 1.0;', '}'].join('\n');
const AFTER = ['void main() {', '  float a = 1.0;', '  a += uBass;', '}'].join(
  '\n',
);

const WORLD = ['{', '  "vars": { "kick": "decay(beat, 0.3)" }', '}'].join('\n');
const WORLD_AFTER = [
  '{',
  '  "vars": { "kick": "decay(beat, 0.3)" },',
  '  "exposure": 1',
  '}',
].join('\n');

/** A scene with a 3D world: the shader, its details, the world, and a model too big to show. */
const files = (world = WORLD): IProjectCodeFile[] => [
  { file: 'scene.frag', role: 'scene', bytes: 40, text: BEFORE },
  { file: 'pack.json', role: 'pack', bytes: 18, text: '{\n  "id": "sea"\n}' },
  { file: 'world.json', role: 'world', bytes: world.length, text: world },
  { file: 'world-city.json', role: 'world', bytes: 3_400_000 },
];

const editor = () =>
  screen.getByRole('textbox', { name: 'studio.code.label:scene.frag' });
const status = () => screen.getByRole('status');
/** The bar that folds a file, by the file's name. */
const fold = (file: string) =>
  screen.getByRole('button', {
    name: new RegExp(`^${file.replace(/[.]/g, '\\.')}`),
  });
const row = (file: string) => {
  const card = fold(file).closest('article');
  if (!card) {
    throw new Error(`${file} has no row`);
  }
  return card;
};
const openFiles = () =>
  screen
    .getAllByRole('button', { expanded: true })
    .map((button) => button.textContent);

/** The tab draws nothing until its first read of the files has answered. */
const show = async (ui: ReactElement) => {
  const view = render(ui);
  await act(async () => {});
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  resetStudioStore();
  writeStudioSource.mockResolvedValue('written');
  readStudioProjectCode.mockResolvedValue([]);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { writeStudioSource, readStudioProjectCode } },
  });
});

describe('the lines the pane marks as wrong', () => {
  it("are the source's rule lines and the compile log's, once each", () => {
    expect(
      problemLinesOf(
        [
          { code: 'bad-json', file: 'source', line: 4 },
          { code: 'bad-json', file: 'pack.json', line: 9 },
          { code: 'missing-file', file: 'artwork' },
        ],
        'ERROR: 0:4: undeclared\nERROR: 0:12: syntax error',
      ),
    ).toEqual([4, 12]);
    expect(problemLinesOf(undefined, undefined)).toEqual([]);
  });
});

describe("the scene's own code", () => {
  it('shows the file as it is, which is not a change to it', async () => {
    await show(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    expect(editor()).toHaveValue(BEFORE);
    expect(status()).toHaveTextContent('studio.code.watching');
    expect(
      screen.queryByRole('button', { name: 'studio.code.showChanges' }),
    ).not.toBeInTheDocument();
  });

  it('takes an outside save, and marks and shows what it changed', async () => {
    const { container, rerender } = await show(
      <StudioCode source={source(BEFORE)} problemLines={[]} />,
    );
    rerender(<StudioCode source={source(AFTER)} problemLines={[]} />);
    expect(editor()).toHaveValue(AFTER);
    expect(status()).toHaveTextContent('studio.code.updatedAt:');
    expect(container.querySelector('.studio-code__delta')).toHaveTextContent(
      '+1−0',
    );
    // The added line is the third, lit in the gutter.
    const gutter = container.querySelectorAll('.studio-code__gutter span');
    expect(gutter[2]).toHaveClass('is-added');
    expect(gutter[1]).not.toHaveClass('is-added');

    fireEvent.click(
      screen.getByRole('button', { name: 'studio.code.showChanges' }),
    );
    expect(
      screen.getByRole('region', { name: 'studio.code.showChanges' }),
    ).toHaveTextContent('a += uBass;');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it("saves the member's typing, and takes that save coming back as their own", async () => {
    const { rerender } = await show(
      <StudioCode source={source(BEFORE)} problemLines={[]} />,
    );
    const save = screen.getByRole('button', { name: 'studio.code.save' });
    expect(save).toBeDisabled();

    fireEvent.change(editor(), { target: { value: AFTER } });
    expect(status()).toHaveTextContent('studio.code.unsaved');
    await act(async () => {
      fireEvent.click(save);
    });
    expect(writeStudioSource).toHaveBeenCalledWith(AFTER);
    expect(status()).toHaveTextContent('studio.code.watching');

    // The watcher reads the pane's own save back: nothing to offer or mark.
    rerender(<StudioCode source={source(AFTER)} problemLines={[]} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('studio.code.watching');
  });

  it('saves on Ctrl+S from the code', async () => {
    await show(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    fireEvent.change(editor(), { target: { value: AFTER } });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 's', ctrlKey: true });
    });
    expect(writeStudioSource).toHaveBeenCalledWith(AFTER);
  });

  it('offers an outside save instead of writing it over typing, and loads it on request', async () => {
    const { rerender } = await show(
      <StudioCode source={source(BEFORE)} problemLines={[]} />,
    );
    const typed = `${BEFORE}\n// mine`;
    fireEvent.change(editor(), { target: { value: typed } });
    rerender(<StudioCode source={source(AFTER)} problemLines={[]} />);

    expect(screen.getByRole('alert')).toHaveTextContent('studio.code.changed');
    expect(editor()).toHaveValue(typed);

    fireEvent.click(screen.getByRole('button', { name: 'studio.code.load' }));
    expect(editor()).toHaveValue(AFTER);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the typing on request, still unsaved', async () => {
    const { rerender } = await show(
      <StudioCode source={source(BEFORE)} problemLines={[]} />,
    );
    const typed = `${BEFORE}\n// mine`;
    fireEvent.change(editor(), { target: { value: typed } });
    rerender(<StudioCode source={source(AFTER)} problemLines={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'studio.code.keep' }));
    expect(editor()).toHaveValue(typed);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('studio.code.unsaved');
  });

  it('says a save too large for a scene was not saved', async () => {
    writeStudioSource.mockResolvedValue('too-large');
    await show(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    fireEvent.change(editor(), { target: { value: AFTER } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'studio.code.save' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('studio.code.tooLarge');
    expect(status()).toHaveTextContent('studio.code.unsaved');
  });

  it('says so when the project has no scene file to show', async () => {
    await show(<StudioCode source={undefined} problemLines={[]} />);
    expect(screen.getByText('studio.code.missing')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studio.code.save' }),
    ).not.toBeInTheDocument();
  });

  it('is shown open when it is the only file, whatever the old pane stored', async () => {
    // The pane once had one fold of its own, kept under this key.
    window.localStorage.setItem('fluideq.studio.codeOpen', 'false');
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    expect(editor()).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /studio.code.title/ }),
    ).toBeInTheDocument();
    // Nothing to fold all of, with one file.
    expect(
      screen.queryByRole('button', { name: 'studio.code.expandAll' }),
    ).not.toBeInTheDocument();
  });

  it('is still shown when the other files could not be read', async () => {
    readStudioProjectCode.mockRejectedValue(new Error('gone'));
    await show(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    expect(editor()).toHaveValue(BEFORE);
  });

  it('stays open when the scene gains more files while it is being read', async () => {
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    // The member's AI writes the scene a world; the Studio reads again.
    readStudioProjectCode.mockResolvedValue(files());
    await act(async () => {
      fireEvent(window, new Event('focus'));
    });
    expect(editor()).toHaveValue(BEFORE);
    // The files that came are listed under it, folded.
    expect(openFiles()).toEqual(['scene.fragstudio.code.role.scene']);
    expect(fold('world.json')).toBeInTheDocument();
  });
});

describe("every file of the scene, in the Code tab's list", () => {
  beforeEach(() => {
    readStudioProjectCode.mockResolvedValue(files());
  });

  it('opens as the list of them, every one folded and saying what it is', async () => {
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    expect(
      screen
        .getAllByRole('button', { expanded: false })
        .map((button) => button.textContent),
    ).toEqual([
      'scene.fragstudio.code.role.scene',
      'pack.jsonstudio.code.role.pack',
      'world.jsonstudio.code.role.world',
      'world-city.jsonstudio.code.role.world',
    ]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(row('pack.json')).toHaveTextContent('studio.code.lines:3 · 0.1 kB');
    // Too large to show: its size, and no line count it does not have.
    expect(row('world-city.json')).toHaveTextContent('3.2 MB');
    expect(row('world-city.json')).not.toHaveTextContent('studio.code.lines');
    // Folded with nothing new to say, the scene's row offers no Save.
    expect(
      screen.queryByRole('button', { name: 'studio.code.save' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('opens and folds each by its name, and all of them at once', async () => {
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    const expand = screen.getByRole('button', {
      name: 'studio.code.expandAll',
    });
    const collapse = screen.getByRole('button', {
      name: 'studio.code.collapseAll',
    });
    expect(collapse).toBeDisabled();

    fireEvent.click(fold('pack.json'));
    expect(openFiles()).toEqual(['pack.jsonstudio.code.role.pack']);
    const pack = screen.getByRole('textbox', {
      name: 'studio.code.label:pack.json',
    });
    expect(pack).toHaveValue('{\n  "id": "sea"\n}');
    // Shown, never edited here: no typing, and no Save of its own.
    expect(pack).toHaveAttribute('readonly');
    expect(row('pack.json')).toHaveTextContent('studio.code.viewOnly');
    expect(
      within(row('pack.json')).queryByRole('button', {
        name: 'studio.code.save',
      }),
    ).not.toBeInTheDocument();
    // The scene's own file is the one that is.
    fireEvent.click(fold('scene.frag'));
    expect(editor()).not.toHaveAttribute('readonly');

    fireEvent.click(expand);
    expect(openFiles()).toHaveLength(4);
    expect(expand).toBeDisabled();
    expect(row('world-city.json')).toHaveTextContent(
      'studio.code.tooLargeToShow:3.2 MB',
    );

    fireEvent.click(fold('world.json'));
    expect(openFiles()).toHaveLength(3);
    expect(expand).toBeEnabled();

    fireEvent.click(collapse);
    expect(screen.queryAllByRole('button', { expanded: true })).toEqual([]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps what was open for the project, and only for it', async () => {
    const first = await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    fireEvent.click(fold('world.json'));
    first.unmount();

    const again = await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    expect(openFiles()).toEqual(['world.jsonstudio.code.role.world']);
    again.unmount();

    // The control: another project starts as a first visit does.
    await show(
      <StudioCode projectId="two" source={source(BEFORE)} problemLines={[]} />,
    );
    expect(screen.queryAllByRole('button', { expanded: true })).toEqual([]);
  });

  it('keeps typing through a fold, and offers its Save on the folded row', async () => {
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    fireEvent.click(fold('scene.frag'));
    fireEvent.change(editor(), { target: { value: AFTER } });
    fireEvent.click(fold('scene.frag'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('studio.code.unsaved');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'studio.code.save' }));
    });
    expect(writeStudioSource).toHaveBeenCalledWith(AFTER);

    fireEvent.click(fold('scene.frag'));
    expect(editor()).toHaveValue(AFTER);
  });

  it('marks a file saved from outside on its row, and opens the change when asked', async () => {
    const { container } = await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    // The first read is the files as they are: nothing is marked.
    expect(container.querySelector('.studio-code__delta')).toBeNull();

    // The window is come back to, as from the member's own editor.
    readStudioProjectCode.mockResolvedValue(files(WORLD_AFTER));
    await act(async () => {
      fireEvent(window, new Event('focus'));
    });
    expect(
      row('world.json').querySelector('.studio-code__delta'),
    ).toHaveTextContent('+2−1');
    expect(row('world.json')).toHaveTextContent('studio.code.updatedAt:');
    // The control: the files that did not change say nothing.
    expect(row('pack.json').querySelector('.studio-code__delta')).toBeNull();
    expect(row('scene.frag').querySelector('.studio-code__delta')).toBeNull();

    fireEvent.click(
      within(row('world.json')).getByRole('button', {
        name: 'studio.code.showChanges',
      }),
    );
    expect(openFiles()).toEqual(['world.jsonstudio.code.role.world']);
    expect(
      screen.getByRole('region', { name: 'studio.code.showChanges' }),
    ).toHaveTextContent('"exposure": 1');

    fireEvent.click(
      within(row('world.json')).getByRole('button', {
        name: 'studio.code.showCode',
      }),
    );
    const world = screen.getByRole('textbox', {
      name: 'studio.code.label:world.json',
    });
    expect(world).toHaveValue(WORLD_AFTER);
    const gutter = row('world.json').querySelectorAll(
      '.studio-code__gutter span',
    );
    expect(gutter[2]).toHaveClass('is-added');
    expect(gutter[0]).not.toHaveClass('is-added');
  });

  it('reads the files again whenever the Studio hears of the project', async () => {
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    expect(readStudioProjectCode).toHaveBeenCalledTimes(1);
    await act(async () => {
      adoptStudioStateForTesting({
        mayAddProject: true,
        projectsRoot: 'D:\\Studio',
        projects: [{ id: 'one', folderName: 'One', path: 'D:\\Studio\\One' }],
        activeId: 'one',
      });
    });
    expect(readStudioProjectCode).toHaveBeenCalledTimes(2);
  });

  it('shows the newest read, whichever answers last', async () => {
    let answerFirst: (list: IProjectCodeFile[]) => void = () => undefined;
    readStudioProjectCode.mockReturnValueOnce(
      new Promise<IProjectCodeFile[]>((resolve) => {
        answerFirst = resolve;
      }),
    );
    await show(
      <StudioCode projectId="one" source={source(BEFORE)} problemLines={[]} />,
    );
    // A second read, asked while the first is still out, answers at once.
    readStudioProjectCode.mockResolvedValue(files(WORLD_AFTER));
    await act(async () => {
      fireEvent(window, new Event('focus'));
    });
    await act(async () => {
      answerFirst(files().slice(0, 2));
    });
    // The first, late, would have taken the world out of the list.
    expect(fold('world.json')).toBeInTheDocument();
  });
});

describe("the Studio's view of the code", () => {
  const state = (activeId: string): IStudioState => ({
    mayAddProject: true,
    projectsRoot: 'D:\\Studio',
    projects: [
      { id: 'one', folderName: 'One', path: 'D:\\Studio\\One' },
      { id: 'two', folderName: 'Two', path: 'D:\\Studio\\Two' },
    ],
    activeId,
  });

  it("holds the open project's code, and lets it go when another project opens", async () => {
    let changed: (next: IStudioState) => void = () => undefined;
    let sourceChanged: (next: IProjectSource | null) => void = () => undefined;
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          openStudio: jest.fn(async () => state('one')),
          closeStudio: jest.fn(async () => undefined),
          onStudioChanged: (listener: typeof changed) => {
            changed = listener;
            return () => undefined;
          },
          onStudioSourceChanged: (listener: typeof sourceChanged) => {
            sourceChanged = listener;
            return () => undefined;
          },
        },
      },
    });
    const { result } = renderHook(() => useStudio());
    let close: () => void = () => undefined;
    await act(async () => {
      close = openStudioSession();
    });

    act(() => sourceChanged(source(BEFORE)));
    expect(result.current.source).toEqual(source(BEFORE));

    // A new build of the same project keeps the code on show.
    act(() => changed(state('one')));
    expect(result.current.source).toEqual(source(BEFORE));

    // The control: another project's code is not this one's.
    act(() => changed(state('two')));
    expect(result.current.source).toBeUndefined();

    // A file that went is shown as gone.
    act(() => sourceChanged(source(AFTER)));
    act(() => sourceChanged(null));
    expect(result.current.source).toBeUndefined();
    close();
  });
});
