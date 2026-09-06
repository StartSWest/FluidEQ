import { act, renderHook } from '@testing-library/react';
import { cycleGraphLook } from 'renderer/utils/graphStyle';
import {
  readGraphAutoCycle,
  saveGraphAutoCycle,
  useGraphAutoCycle,
} from 'renderer/utils/graphAutoCycle';

jest.mock('renderer/utils/graphStyle', () => ({ cycleGraphLook: jest.fn() }));

describe('automatic visualizer switching', () => {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const paintAt = (time: number) => {
    now = time;
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => callbacks.forEach((callback) => callback(time)));
  };

  beforeEach(() => {
    now = 0;
    frames.clear();
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        nextId += 1;
        frames.set(nextId, callback);
        return nextId;
      });
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => frames.delete(id));
  });

  afterEach(() => jest.restoreAllMocks());

  it('switches once per interval and gives a manual selection a fresh interval', () => {
    const hook = renderHook(({ id }) => useGraphAutoCycle(10, false, id), {
      initialProps: { id: 'bars-signal' },
    });
    paintAt(9999);
    expect(cycleGraphLook).not.toHaveBeenCalled();
    paintAt(10000);
    expect(cycleGraphLook).toHaveBeenCalledTimes(1);
    expect(cycleGraphLook).toHaveBeenCalledWith(1);
    paintAt(15000);
    hook.rerender({ id: 'flames-signal' });
    paintAt(24999);
    expect(cycleGraphLook).toHaveBeenCalledTimes(1);
    paintAt(25000);
    expect(cycleGraphLook).toHaveBeenCalledTimes(2);
    hook.unmount();
    expect(frames.size).toBe(0);
  });

  it('suspends for editing and Off, without leaving a running frame loop', () => {
    const hook = renderHook(
      ({ seconds, editing }) =>
        useGraphAutoCycle(seconds, editing, 'bars-signal'),
      { initialProps: { seconds: 10, editing: false } },
    );
    paintAt(9000);
    hook.rerender({ seconds: 10, editing: true });
    expect(frames.size).toBe(0);
    paintAt(40000);
    hook.rerender({ seconds: 10, editing: false });
    paintAt(49999);
    expect(cycleGraphLook).not.toHaveBeenCalled();
    paintAt(50000);
    expect(cycleGraphLook).toHaveBeenCalledTimes(1);
    hook.rerender({ seconds: 0, editing: false });
    expect(frames.size).toBe(0);
  });

  it.each(['graph-look-menu', 'graph-auto-cycle-menu'])(
    'waits until %s closes',
    (className) => {
      renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
      const menu = document.createElement('div');
      menu.className = className;
      document.body.append(menu);
      paintAt(30000);
      expect(cycleGraphLook).not.toHaveBeenCalled();
      menu.remove();
      paintAt(39999);
      expect(cycleGraphLook).not.toHaveBeenCalled();
      paintAt(40000);
      expect(cycleGraphLook).toHaveBeenCalledTimes(1);
    },
  );

  it('does not count hidden time or catch up when the window returns', () => {
    renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
    paintAt(8000);
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    now = 80000;
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    paintAt(89999);
    expect(cycleGraphLook).not.toHaveBeenCalled();
    paintAt(90000);
    expect(cycleGraphLook).toHaveBeenCalledTimes(1);
  });

  it('remembers the interval and rejects invalid saved values', () => {
    expect(readGraphAutoCycle()).toBe(0);
    saveGraphAutoCycle(30);
    expect(readGraphAutoCycle()).toBe(30);
    saveGraphAutoCycle(-1);
    expect(readGraphAutoCycle()).toBe(0);
  });
});
