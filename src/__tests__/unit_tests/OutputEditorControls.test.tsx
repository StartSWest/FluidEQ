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

describe('OutputEditButton', () => {
  it('offers Done for the secondary being edited and exits only that editor', async () => {
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toHaveAttribute('aria-pressed', 'true');
    expect(done).toHaveTextContent('Editing');
    await userEvent.setup().click(done);
    expect(activate).toHaveBeenCalledWith(mainOutput.id);
    expect(readOutputEditor().main?.id).toBe(mainOutput.id);
    expect(readOutputEditor().editor?.device.id).toBe(mainOutput.id);
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
    expect(assignDeviceProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit sound' })).toHaveAttribute(
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
      .click(screen.getByRole('button', { name: 'Edit sound' }));
    expect(activate).toHaveBeenCalledWith(secondOutput.id);
    expect(readOutputEditor().editor?.device.id).toBe(secondOutput.id);
    expect(readOutputEditor().main?.id).toBe(mainOutput.id);
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
  });

  it('supports the Done action by keyboard and holds another press while changing editors', async () => {
    const pending = deferred<void>();
    activate.mockImplementation(async () => {
      await pending.promise;
      editor = mainOutput;
    });
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    const done = screen.getByRole('button', { name: 'Done' });
    const user = userEvent.setup();
    await user.tab();
    expect(done).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(done).toBeDisabled();
    fireEvent.click(done);
    expect(activate).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve();
    });
    expect(screen.getByRole('button', { name: 'Edit sound' })).toBeEnabled();
  });

  it('cannot exit an editor that is already main', () => {
    editor = mainOutput;
    showOutputEditor(main, editor);
    render(<OutputEditButton device={mainOutput} />, { wrapper });
    const selected = screen.getByRole('button', { name: 'Editing' });
    expect(selected).toBeDisabled();
    fireEvent.click(selected);
    expect(activate).not.toHaveBeenCalled();
    expect(setDefaultAudioDevice).not.toHaveBeenCalled();
  });

  it('keeps the secondary selected and reports an activation refusal', async () => {
    const refusal = getErrorDescription(ErrorCode.INVALID_PARAMETER);
    activate.mockRejectedValueOnce(refusal);
    render(<OutputEditButton device={secondOutput} />, { wrapper });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Done' }));
    expect(setGlobalError).toHaveBeenCalledWith(refusal);
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
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

  it('refuses a control when no main output has been discovered', async () => {
    updateOutputEditor(getDefaultState());
    const { result } = renderHook(() => useMainOutputEditor(), { wrapper });
    await expect(result.current()).rejects.toEqual(
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
