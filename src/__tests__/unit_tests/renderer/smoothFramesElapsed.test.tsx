import { act, renderHook } from '@testing-library/react';
import useSmoothFrames from '../../../renderer/utils/useSmoothFrames';

/**
 * A kick is stamped with `performance.now()` and a frame with the moment its
 * frame began, which for the first frame after a kick from an event can be
 * earlier than the kick. That was handed to the drawing as negative time:
 * Braid's clock stepped back, a mote born a moment "later" had a negative
 * age, and the look threw on its first frame (2026-09-28, when Braid came
 * back). The later frame is the control: time still passes.
 */
it('never hands a frame negative time', () => {
  const frames: FrameRequestCallback[] = [];
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
  const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
  const seen: number[] = [];
  try {
    const { result } = renderHook(() =>
      useSmoothFrames(
        (deltaMs) => {
          seen.push(deltaMs);
          return seen.length < 2;
        },
        { isEnabled: true },
      ),
    );
    act(() => result.current());
    // The frame began 4 ms before the kick was stamped.
    act(() => frames.shift()?.(996));
    act(() => frames.shift()?.(1012));
    expect(seen).toEqual([0, 16]);
  } finally {
    raf.mockRestore();
    now.mockRestore();
  }
});
