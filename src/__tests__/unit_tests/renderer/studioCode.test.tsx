/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's code pane: the open project's scene code, live both ways.
 *
 * What is held here is whose text wins. A save from outside — the member's
 * AI, their editor — replaces the pane's text and marks what it changed, but
 * only while nothing is typed there; typed text is the member's until they
 * save it, and an outside save arriving meanwhile is offered, never written
 * over their typing.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import type { IProjectSource } from '../../../main/memberScenes/project';
import StudioCode, {
  problemLinesOf,
} from '../../../renderer/studio/StudioCode';
import {
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

const source = (text: string): IProjectSource => ({ file: 'scene.frag', text });

const BEFORE = ['void main() {', '  float a = 1.0;', '}'].join('\n');
const AFTER = ['void main() {', '  float a = 1.0;', '  a += uBass;', '}'].join(
  '\n',
);

const editor = () =>
  screen.getByRole('textbox', { name: 'studio.code.label:scene.frag' });
const status = () => screen.getByRole('status');

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  resetStudioStore();
  writeStudioSource.mockResolvedValue('written');
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { writeStudioSource } },
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

describe('the code pane', () => {
  it('shows the file as it is, which is not a change to it', () => {
    render(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    expect(editor()).toHaveValue(BEFORE);
    expect(status()).toHaveTextContent('studio.code.watching');
    expect(
      screen.queryByRole('button', { name: 'studio.code.showChanges' }),
    ).not.toBeInTheDocument();
  });

  it('takes an outside save, and marks and shows what it changed', () => {
    const { container, rerender } = render(
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
    const { rerender } = render(
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
    render(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    fireEvent.change(editor(), { target: { value: AFTER } });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: 's', ctrlKey: true });
    });
    expect(writeStudioSource).toHaveBeenCalledWith(AFTER);
  });

  it('offers an outside save instead of writing it over typing, and loads it on request', () => {
    const { rerender } = render(
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

  it('keeps the typing on request, still unsaved', () => {
    const { rerender } = render(
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
    render(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    fireEvent.change(editor(), { target: { value: AFTER } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'studio.code.save' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('studio.code.tooLarge');
    expect(status()).toHaveTextContent('studio.code.unsaved');
  });

  it('says so when the project has no scene file to show', () => {
    render(<StudioCode source={undefined} problemLines={[]} />);
    expect(screen.getByText('studio.code.missing')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studio.code.save' }),
    ).not.toBeInTheDocument();
  });

  it('remembers being folded away', () => {
    const { unmount } = render(
      <StudioCode source={source(BEFORE)} problemLines={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /studio.code.title/ }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    unmount();
    render(<StudioCode source={source(BEFORE)} problemLines={[]} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /studio.code.title/ }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});

describe("the Studio's view of the code", () => {
  const state = (activeId: string): IStudioState => ({
    entitled: true,
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
