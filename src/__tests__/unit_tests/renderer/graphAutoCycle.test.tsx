import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import GraphAutoCycle from 'renderer/graph/GraphAutoCycle';
import LookPicker from 'renderer/graph/LookPicker';
import { cycleGraphLookUnattended } from 'renderer/utils/graphStyle';
import {
  readGraphAutoCycle,
  saveGraphAutoCycle,
  useGraphAutoCycle,
  useHoldGraphAutoCycle,
} from 'renderer/utils/graphAutoCycle';

jest.mock('renderer/utils/graphStyle', () => ({
  ...jest.requireActual('renderer/utils/graphStyle'),
  cycleGraphLookUnattended: jest.fn(),
}));

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
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(10000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    expect(cycleGraphLookUnattended).toHaveBeenCalledWith(1);
    paintAt(15000);
    hook.rerender({ id: 'flames-signal' });
    paintAt(24999);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    paintAt(25000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(2);
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
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(50000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    hook.rerender({ seconds: 0, editing: false });
    expect(frames.size).toBe(0);
  });

  // The graph's cycle stays mounted, out of sight, while the player runs its
  // own. Both counting stepped twice on one frame and skipped every other
  // look; the one step here is also the control that the newest does count.
  it('lets only the newest running cycle count, and hands the count back when it stops', () => {
    renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
    const player = renderHook(() =>
      useGraphAutoCycle(10, false, 'bars-signal'),
    );
    paintAt(10000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    paintAt(15000);
    player.unmount();
    paintAt(24999);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
    paintAt(25000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(2);
  });

  // The first test is the control: unheld, the same cycle switches at 10 s,
  // so nothing by 30 s here is the hold and not a cycle that never runs.
  it('does not advance while a picker holds it open, and starts a fresh interval once it closes', () => {
    renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
    const picker = renderHook(({ open }) => useHoldGraphAutoCycle(open), {
      initialProps: { open: false },
    });
    paintAt(5000);
    picker.rerender({ open: true });
    paintAt(30000);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    picker.rerender({ open: false });
    paintAt(39999);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(40000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
  });

  it('stays held until the last open picker closes or goes away', () => {
    renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
    const looks = renderHook(({ open }) => useHoldGraphAutoCycle(open), {
      initialProps: { open: true },
    });
    const interval = renderHook(() => useHoldGraphAutoCycle(true));
    paintAt(20000);
    looks.rerender({ open: false });
    paintAt(40000);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    interval.unmount();
    paintAt(49999);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(50000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
  });

  it('holds while its own interval list is open', () => {
    saveGraphAutoCycle(10);
    render(
      <GraphAutoCycle
        selectedLookId="bars-signal"
        isWaveHidden={false}
        isEditing={false}
      />,
    );
    const trigger = screen.getByRole('menu', {
      name: 'Automatic visualizer switching',
    });
    fireEvent.click(trigger);
    expect(screen.getAllByRole('menuitem')).toHaveLength(6);
    paintAt(30000);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menuitem')).toBeNull();
    paintAt(39999);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(40000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
  });

  it('holds while the look explorer is open', () => {
    renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
    render(
      <LookPicker
        value="bars-signal"
        disabled={false}
        onChoose={() => undefined}
      />,
    );
    const trigger = screen.getByRole('button', {
      name: 'Styles and visualizers',
    });
    fireEvent.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'Styles and visualizers' }),
    ).toBeTruthy();
    paintAt(30000);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    paintAt(39999);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(40000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
  });

  it('does not count hidden time or catch up when the window returns', () => {
    renderHook(() => useGraphAutoCycle(10, false, 'bars-signal'));
    paintAt(8000);
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    now = 80000;
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    paintAt(89999);
    expect(cycleGraphLookUnattended).not.toHaveBeenCalled();
    paintAt(90000);
    expect(cycleGraphLookUnattended).toHaveBeenCalledTimes(1);
  });

  it('cycles every two minutes until told otherwise, remembers the interval and rejects invalid saved values', () => {
    expect(readGraphAutoCycle()).toBe(120);
    saveGraphAutoCycle(0);
    expect(readGraphAutoCycle()).toBe(0);
    saveGraphAutoCycle(30);
    expect(readGraphAutoCycle()).toBe(30);
    saveGraphAutoCycle(-1);
    expect(readGraphAutoCycle()).toBe(0);
  });
});
