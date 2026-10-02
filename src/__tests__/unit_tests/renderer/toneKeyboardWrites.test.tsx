import { act, renderHook } from '@testing-library/react';
import useTone from 'renderer/eq/useTone';
import { setTone } from 'renderer/utils/equalizerApi';

const mockRefresh = jest.fn();
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqLayers: () => ({
    tone: { bass: 0, mid: 0, treble: 0 },
    setTone: jest.fn(),
    refreshState: mockRefresh,
    setGlobalError: jest.fn(),
    isBlockingError: false,
  }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setTone: jest.fn(async () => undefined),
}));

it('saves a key step that arrives while the previous write is being read back', async () => {
  let finishRead = () => {};
  const reading = new Promise<void>((resolve) => {
    finishRead = resolve;
  });
  mockRefresh.mockReturnValueOnce(reading).mockResolvedValue(undefined);
  const { result } = renderHook(() => useTone());
  let first: Promise<void> | undefined;
  await act(async () => {
    first = result.current.turnTone('bass', 0.1);
    await Promise.resolve();
  });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  await act(async () => result.current.turnTone('bass', 0.2));
  await act(async () => {
    finishRead();
    await first;
  });
  expect(setTone).toHaveBeenLastCalledWith({ bass: 0.2, mid: 0, treble: 0 });
});
