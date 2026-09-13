/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The IPC bridge's subscribe/unsubscribe contract.
 *
 * Worth testing because the way this fails is invisible. A remover that builds
 * a new wrapper instead of using the registered one throws nothing, logs
 * nothing and returns nothing — it just does not remove, and the only symptom
 * is a listener count that climbs for the life of the window plus, eventually,
 * a reply delivered to the wrong request.
 *
 * So these assert on the emitter's actual registrations rather than on whether
 * a call was made.
 */

/** A stand-in for Electron's emitter, tracking exactly what is registered. */
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

const register = (channel: string, fn: (...args: unknown[]) => void) => {
  const set = listeners.get(channel) ?? new Set();
  set.add(fn);
  listeners.set(channel, set);
};

const registeredCount = (channel: string) => listeners.get(channel)?.size ?? 0;

const send = jest.fn();

jest.mock('electron', () => ({
  ipcRenderer: {
    on: (channel: string, fn: (...args: unknown[]) => void) =>
      register(channel, fn),
    removeListener: (channel: string, fn: (...args: unknown[]) => void) => {
      listeners.get(channel)?.delete(fn);
    },
    send: (...args: unknown[]) => send(...args),
    invoke: () => Promise.resolve(''),
  },
  contextBridge: { exposeInMainWorld: () => undefined },
}));

// eslint-disable-next-line import/first
import api from 'main/api';

describe('the ipc bridge', () => {
  beforeEach(() => {
    listeners.clear();
    send.mockClear();
  });

  it('removes the listener `on` actually registered', () => {
    const unsubscribe = api.ipcRenderer.on('a-channel', () => undefined);
    expect(registeredCount('a-channel')).toBe(1);
    unsubscribe();
    expect(registeredCount('a-channel')).toBe(0);
  });

  it('does not accumulate across many subscribe/unsubscribe cycles', () => {
    // What the broken remover produced: a count that only ever went up.
    for (let round = 0; round < 50; round += 1) {
      api.ipcRenderer.on('c-channel', () => undefined)();
    }
    expect(registeredCount('c-channel')).toBe(0);
  });

  // Main hands the id back beside its reply, which is the only thing that
  // tells one waiting request's answer from another's on the same channel.
  it('sends a request id after the arguments when the window waits on a reply', () => {
    api.ipcRenderer.sendMessage('f-channel', ['value'], 17);
    expect(send).toHaveBeenCalledWith('f-channel', ['value'], 17);
  });

  it('sends a message nobody answers exactly as before', () => {
    api.ipcRenderer.sendMessage('g-channel', ['value']);
    expect(send.mock.calls).toEqual([['g-channel', ['value']]]);
  });

  it('delivers the id a reply hands back after its payload', () => {
    const seen: unknown[] = [];
    api.ipcRenderer.on('h-channel', (...args) => seen.push(...args));
    const [registered] = [...(listeners.get('h-channel') ?? [])];
    registered({} as never, { result: 3 }, 17);
    expect(seen).toEqual([{ result: 3 }, 17]);
  });

  it('unsubscribes one listener without disturbing its siblings', () => {
    const stop = api.ipcRenderer.on('d-channel', () => undefined);
    api.ipcRenderer.on('d-channel', () => undefined);
    expect(registeredCount('d-channel')).toBe(2);
    stop();
    expect(registeredCount('d-channel')).toBe(1);
  });

  it('still delivers the payload without the electron event object', () => {
    // The wrapper exists to strip the IpcRendererEvent, and removal must not
    // come at the cost of that.
    const seen: unknown[] = [];
    api.ipcRenderer.on('e-channel', (...args) => seen.push(...args));
    const [registered] = [...(listeners.get('e-channel') ?? [])];
    registered({} as never, 'payload');
    expect(seen).toEqual(['payload']);
  });
});
