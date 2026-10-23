import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultState } from 'common/constants';
import { ErrorCode, getErrorDescription } from 'common/errors';
import OutputEditButton from 'renderer/OutputEditButton';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import {
  readOutputEditor,
  updateOutputEditor,
} from 'renderer/utils/outputEditor';
import useMainOutputEditor from 'renderer/utils/useMainOutputEditor';
import useMainEditorWhile from 'renderer/utils/useMainEditorWhile';
import {
  activateAudioDeviceProfile,
  assignDeviceProfile,
  setDefaultAudioDevice,
} from 'renderer/utils/equalizerApi';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  deferred,
  mainOutput,
  secondOutput,
  showOutputEditor,
} from '__tests__/utils/outputEditorFixture';

jest.mock('renderer/utils/equalizerApi', () => ({
  activateAudioDeviceProfile: jest.fn(),
  assignDeviceProfile: jest.fn(),
  setDefaultAudioDevice: jest.fn(),
}));

const activate = jest.mocked(activateAudioDeviceProfile);
let main = mainOutput;
let editor = secondOutput;
const refreshState = jest.fn(async () => {
  showOutputEditor(main, editor);
});
const setGlobalError = jest.fn();
const wrapper = ({ children }: { children: ReactNode }) => (
  <FluidEqProviderWrapper
    value={{ ...defaultFluidEqContext, refreshState, setGlobalError }}
  >
    {children}
  </FluidEqProviderWrapper>
);

beforeEach(() => {
  jest.resetAllMocks();
  main = mainOutput;
  editor = secondOutput;
  showOutputEditor(main, editor);
  refreshState.mockImplementation(async () => {
    showOutputEditor(main, editor);
  });
  activate.mockImplementation(async (id) => {
    editor = id === mainOutput.id ? mainOutput : secondOutput;
  });
});

/**
 * A toggle keeps one name whatever its state, the state being aria-pressed:
 * it was named "Done" while pressed, and every second output's "Edit sound",
 * so two outputs' buttons could not be told apart.
 */
const EDIT_SECOND = `Edit ${secondOutput.name} without switching the main output`;
const EDIT_MAIN = `Edit ${mainOutput.name} without switching the main output`;

describe('OutputEditButton', () => {
  it('offers Done for the secondary being edited and exits only that editor', async () => {
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    const done = screen.getByRole('button', { name: EDIT_SECOND });
    expect(done).toHaveAttribute('aria-pressed', 'true');
    expect(done).toHaveTextContent('Editing');
    await userEvent.setup().click(done);
    expect(activate).toHaveBeenCalledWith(mainOutput.id);
    expect(readOutputEditor().main?.id).toBe(mainOutput.id);
    expect(readOutputEditor().editor?.device.id).toBe(mainOutput.id);
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
    expect(assignDeviceProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: EDIT_SECOND })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('enters a secondary editor without changing the main playback output', async () => {
    editor = mainOutput;
    showOutputEditor(main, editor);
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: EDIT_SECOND }));
    expect(activate).toHaveBeenCalledWith(secondOutput.id);
    expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
    expect(readOutputEditor().main?.id).toBe(mainOutput.id);
    const pressed = screen.getByRole('button', { name: EDIT_SECOND });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(pressed).not.toHaveAttribute('aria-disabled');
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
  });

  it('supports the Done action by keyboard and holds another press while changing editors', async () => {
    const pending = deferred<void>();
    activate.mockImplementation(async () => {
      await pending.promise;
      editor = mainOutput;
    });
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    const done = screen.getByRole('button', { name: EDIT_SECOND });
    const user = userEvent.setup();
    await user.tab();
    expect(done).toHaveFocus();
    await user.keyboard('{Enter}');
    // Held, and the keyboard keeps its place: a disabled button let it go.
    expect(done).toHaveAttribute('aria-disabled', 'true');
    expect(done).toHaveFocus();
    fireEvent.click(done);
    expect(activate).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve();
    });
    expect(done).not.toHaveAttribute('aria-disabled');
    expect(done).toHaveAttribute('aria-pressed', 'false');
    expect(done).toHaveFocus();
  });

  it('cannot exit an editor that is already main', () => {
    editor = mainOutput;
    showOutputEditor(main, editor);
    render(<OutputEditButton device={mainOutput} />, { wrapper });
    const selected = screen.getByRole('button', { name: EDIT_MAIN });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(selected);
    expect(activate).not.toHaveBeenCalled();
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
  });

  it('keeps the secondary selected and reports an activation refusal', async () => {
    const refusal = getErrorDescription(ErrorCode.INVALID_PARAMETER);
    activate.mockRejectedValueOnce(refusal);
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: EDIT_SECOND }));
    expect(setGlobalError).toHaveBeenCalledWith(refusal);
    const still = screen.getByRole('button', { name: EDIT_SECOND });
    expect(still).not.toHaveAttribute('aria-disabled');
    expect(still).toHaveAttribute('aria-pressed', 'true');
    expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
    expect(refreshState).not.toHaveBeenCalled();
  });
});

describe('useMainOutputEditor', () => {
  it('shares one pending activation across a capture handler and its mutation', async () => {
    const pending = deferred<void>();
    activate.mockImplementation(async () => {
      await pending.promise;
      editor = mainOutput;
    });
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    const first = result.current(mainOutput.id);
    const second = result.current(mainOutput.id);
    expect(second).toBe(first);
    expect(activate).toHaveBeenCalledTimes(1);
    pending.resolve();
    await first;
    expect(refreshState).toHaveBeenCalledTimes(1);
    expect(readOutputEditor().editor?.device.id).toBe(mainOutput.id);
    await result.current(mainOutput.id);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('refuses a stale output control before activating anything', async () => {
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    await expect(result.current(secondOutput.id)).rejects.toEqual(
      getErrorDescription(ErrorCode.INVALID_PARAMETER),
    );
    expect(activate).not.toHaveBeenCalled();
    expect(refreshState).not.toHaveBeenCalled();
    await result.current(mainOutput.id);
    expect(activate).toHaveBeenCalledWith(mainOutput.id);
  });

  /**
   * No output known to be playing — the first state read, or Windows naming
   * no default — leaves no other editor to come back from. Refused, the
   * output picker raised an error as it opened and dropped the output picked
   * from it.
   */
  it('lets a control that names no output go ahead before a main output is known', async () => {
    updateOutputEditor(getDefaultState());
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    await expect(result.current()).resolves.toBeUndefined();
    expect(activate).not.toHaveBeenCalled();
  });

  it('refuses a control that names an output before a main output is known', async () => {
    updateOutputEditor(getDefaultState());
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    await expect(result.current(mainOutput.id)).rejects.toEqual(
      getErrorDescription(ErrorCode.INVALID_PARAMETER),
    );
    expect(activate).not.toHaveBeenCalled();
  });

  it('does not release a waiting mutation if refresh still belongs to the secondary editor', async () => {
    activate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    await expect(result.current(mainOutput.id)).rejects.toEqual(
      getErrorDescription(ErrorCode.INVALID_PARAMETER),
    );
    expect(refreshState).toHaveBeenCalledTimes(1);
    expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
  });

  it('rejects an old activation without clearing the new main’s pending activation', async () => {
    const oldActivation = deferred<void>();
    const newActivation = deferred<void>();
    activate.mockImplementationOnce(async () => {
      await oldActivation.promise;
    });
    activate.mockImplementationOnce(async () => {
      await newActivation.promise;
      editor = secondOutput;
    });
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    const old = result.current(mainOutput.id).catch((error: unknown) => error);
    main = secondOutput;
    editor = mainOutput;
    showOutputEditor(main, editor, 2);
    const current = result.current(secondOutput.id);
    oldActivation.resolve();
    await expect(old).resolves.toEqual(
      getErrorDescription(ErrorCode.INVALID_PARAMETER),
    );
    expect(result.current(secondOutput.id)).toBe(current);
    expect(activate).toHaveBeenCalledTimes(2);
    newActivation.resolve();
    await current;
    await waitFor(() =>
      expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id),
    );
  });
});

/**
 * The amp's faders, game mode and preset pick edit whatever output is being
 * edited, and the notice that says which sleeps behind it. Entering the amp
 * — or any surface that speaks for the machine's sound — ends a second
 * output's edit, the way Done does.
 */
describe('useMainEditorWhile', () => {
  it('brings the editor back to the main output while active', async () => {
    renderHook(() => useMainEditorWhile(true), { wrapper });
    await waitFor(() =>
      expect(readOutputEditor().editor?.device.id).toBe(mainOutput.id),
    );
    expect(activate).toHaveBeenCalledWith(mainOutput.id);
  });

  it('leaves a second output’s edit alone while not active (positive control)', () => {
    renderHook(() => useMainEditorWhile(false), { wrapper });
    expect(activate).not.toHaveBeenCalled();
    expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
  });

  it('asks nothing when the main output is already the one edited', () => {
    editor = mainOutput;
    showOutputEditor(main, editor);
    renderHook(() => useMainEditorWhile(true), { wrapper });
    expect(activate).not.toHaveBeenCalled();
  });
});
