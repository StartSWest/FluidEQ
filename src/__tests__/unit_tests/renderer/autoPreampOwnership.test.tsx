import { act, fireEvent, render } from '@testing-library/react';
import AutoPreAmpEnablerSwitch from 'renderer/components/AutoPreAmpEnablerSwitch';
import { useCurrentEngine } from 'renderer/utils/audioEngineContext';
import { useFluidEqContext } from 'renderer/utils/FluidEqContext';
import {
  disableAutoPreAmp,
  enableAutoPreAmp,
} from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/audioEngineContext');
jest.mock('renderer/utils/FluidEqContext');
jest.mock('renderer/utils/equalizerApi');

describe('automatic/manual preamp ownership', () => {
  const setPreAmp = jest.fn();
  const setAutoPreAmpOn = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useCurrentEngine).mockReturnValue('fluid');
    jest.mocked(useFluidEqContext).mockReturnValue({
      isAutoPreAmpOn: true,
      setPreAmp,
      setAutoPreAmpOn,
      setGlobalError: jest.fn(),
    } as unknown as ReturnType<typeof useFluidEqContext>);
  });

  it('does not overwrite a manual reset with a late disable response', async () => {
    let finish: ((value: number) => void) | undefined;
    jest.mocked(disableAutoPreAmp).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<AutoPreAmpEnablerSwitch id="auto" />);
    fireEvent.click(view.getByRole('checkbox'));
    expect(setAutoPreAmpOn).toHaveBeenCalledWith(false);
    setPreAmp(0);
    setPreAmp.mockClear();
    fireEvent.click(view.getByRole('checkbox'));
    expect(disableAutoPreAmp).toHaveBeenCalledTimes(1);
    await act(async () => finish?.(-9));
    expect(setPreAmp).not.toHaveBeenCalled();
  });

  it.each(['fluid', 'apo'] as const)(
    'only APO publishes a calculated value when enabled (%s)',
    async (engine) => {
      jest.mocked(useCurrentEngine).mockReturnValue(engine);
      jest.mocked(useFluidEqContext).mockReturnValue({
        isAutoPreAmpOn: false,
        setPreAmp,
        setAutoPreAmpOn,
        setGlobalError: jest.fn(),
      } as unknown as ReturnType<typeof useFluidEqContext>);
      jest.mocked(enableAutoPreAmp).mockResolvedValue(-4);
      const view = render(<AutoPreAmpEnablerSwitch id="auto" />);
      await act(async () => fireEvent.click(view.getByRole('checkbox')));
      expect(setAutoPreAmpOn).toHaveBeenCalledWith(true);
      expect(setPreAmp.mock.calls).toEqual(engine === 'apo' ? [[-4]] : []);
    },
  );
});
