/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import { WALLPAPER } from 'common/wallpaper';
import startMacWallpaperHost from 'main/wallpaper/macHost';

jest.mock('main/wallpaper/macLevel', () => ({
  __esModule: true,
  default: () => -99,
}));

const surface = () => {
  const contents = Object.assign(new EventEmitter(), { mainFrame: {} });
  const events = new EventEmitter();
  let shown = false;
  const window = {
    webContents: contents,
    isDestroyed: jest.fn(() => false),
    isVisible: () => shown,
    on: events.on.bind(events),
    removeListener: events.removeListener.bind(events),
    setAlwaysOnTop: jest.fn(),
    showInactive: jest.fn(() => {
      shown = true;
      events.emit('show');
    }),
    hide: jest.fn(() => {
      shown = false;
    }),
  };
  const report = jest.fn();
  const host = startMacWallpaperHost(
    window as unknown as BrowserWindow,
    report,
  );
  const visibility = (
    visible: unknown,
    frame = contents.mainFrame,
    channel: string = WALLPAPER.visibility,
  ) => contents.emit('ipc-message', { senderFrame: frame }, channel, visible);
  return { window, contents, events, report, host, visibility };
};

it('uses inactive shows and returns the original desktop when stopped', () => {
  const a = surface();
  expect(a.report.mock.calls).toEqual([['ready'], ['active']]);
  a.host.setVisible(true);
  a.host.setVisible(true);
  expect(a.window.showInactive).toHaveBeenCalledTimes(1);
  // A native visibility answer can be false because a window is covered.
  // It must not make the host repeatedly order that desktop window forward.
  a.window.hide();
  a.host.setVisible(true);
  expect(a.window.showInactive).toHaveBeenCalledTimes(1);
  a.host.setVisible(false);
  expect(a.window.isVisible()).toBe(false);
  a.host.setVisible(true);
  expect(a.window.showInactive).toHaveBeenCalledTimes(2);
  a.host.stop();
  expect(a.window.isVisible()).toBe(false);
  expect(a.contents.listenerCount('ipc-message')).toBe(0);
  expect(a.events.listenerCount('show')).toBe(0);
  a.host.setVisible(true);
  expect(a.window.showInactive).toHaveBeenCalledTimes(2);
});

it('places the picture above the wallpaper but below icons, restoring that level after each show', () => {
  const a = surface();
  expect(a.window.setAlwaysOnTop.mock.calls).toEqual([[true, 'normal', -99]]);
  a.host.setVisible(true);
  expect(a.window.setAlwaysOnTop).toHaveBeenCalledTimes(2);
  a.host.setVisible(false);
  a.host.setVisible(true);
  expect(a.window.setAlwaysOnTop).toHaveBeenCalledTimes(3);
  a.host.stop();
  a.events.emit('show');
  expect(a.window.setAlwaysOnTop).toHaveBeenCalledTimes(3);
});

it('pauses only the occluded monitor and accepts only its main frame visibility', () => {
  const a = surface();
  const b = surface();
  a.report.mockClear();
  b.report.mockClear();
  a.visibility(false, {});
  a.visibility(false, a.contents.mainFrame, 'untrusted');
  a.visibility('hidden');
  expect(a.report).not.toHaveBeenCalled();
  a.visibility(false);
  expect(a.report).toHaveBeenLastCalledWith('paused');
  expect(b.report).not.toHaveBeenCalled();
  a.visibility(true);
  expect(a.report).toHaveBeenLastCalledWith('active');
  a.host.stop();
  a.visibility(false);
  expect(a.report).toHaveBeenCalledTimes(2);
  b.visibility(false);
  expect(b.report).toHaveBeenLastCalledWith('paused');
  b.host.stop();
});

it('does not show a destroyed window or keep any callback after release', () => {
  const a = surface();
  a.window.isDestroyed.mockReturnValue(true);
  a.host.setVisible(true);
  a.host.stop();
  a.host.stop();
  expect(a.window.showInactive).not.toHaveBeenCalled();
  expect(a.window.hide).not.toHaveBeenCalled();
  expect(a.contents.listenerCount('ipc-message')).toBe(0);
});
