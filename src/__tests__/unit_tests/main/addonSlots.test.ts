/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { findAddonCode } from '../../../../.erb/scripts/check-release-addons';
import {
  addonsDisabled,
  mainAddonEntries,
} from '../../../../.erb/scripts/addons';
import {
  IMainAddonServices,
  registerMainAddon,
  resetMainAddons,
  startMainAddons,
} from '../../../main/addons';
import { addonBridge, isAddonChannel } from '../../../main/addonBridge';

const invoke = jest.fn((..._args: unknown[]) => Promise.resolve('answered'));
const on = jest.fn();
const removeListener = jest.fn();

jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: (...args: unknown[]) => invoke(...args),
    on: (...args: unknown[]) => on(...args),
    removeListener: (...args: unknown[]) => removeListener(...args),
  },
}));

const SRC = path.resolve(__dirname, '../../..');

const sourcesUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourcesUnder(full);
    }
    return /\.(ts|tsx|cjs|js)$/.test(entry.name) ? [full] : [];
  });

describe('the release check', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-release-check-'));
    fs.mkdirSync(path.join(dir, 'renderer'));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (name: string, text: string) =>
    fs.writeFileSync(path.join(dir, name), text);

  it('refuses a bundle in which an add-on registers itself', () => {
    write('renderer/renderer.js', 'r({name:"fluideq-addon:admin",places:[]})');

    expect(findAddonCode(dir)).toEqual([
      `${path.join('renderer', 'renderer.js')} (fluideq-addon:)`,
    ]);
  });

  it('refuses a bundle that names an add-on’s channel, even unregistered', () => {
    write('main.js', 'e.handle("addon:admin-review-queue",h)');
    write('index.html', "<script>invoke('addon:x')</script>");

    expect(findAddonCode(dir)).toHaveLength(2);
  });

  it('passes the preload’s own guard and the app’s add-on types', () => {
    write('preload.js', 'const t=/^addon:[a-z0-9][a-z0-9-]{0,80}$/;');
    write('renderer/renderer.js', `e.startsWith("addon:")&&\`addon:\${n}\``);
    write('picture.png', '"fluideq-addon:admin"');

    expect(findAddonCode(dir)).toEqual([]);
  });

  it('finds nothing in a folder that does not exist', () => {
    expect(findAddonCode(path.join(dir, 'missing'))).toEqual([]);
  });
});

describe('the public app', () => {
  it('names no add-on and no add-on channel anywhere in its source', () => {
    const named = sourcesUnder(SRC).filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return /fluideq-addon:/.test(text) || /['"`]addon:[a-z0-9]/.test(text);
    });

    expect(named.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it('loads no add-on when development is told to run without them', () => {
    const before = process.env.FLUIDEQ_NO_ADDONS;
    process.env.FLUIDEQ_NO_ADDONS = '1';
    try {
      expect(addonsDisabled()).toBe(true);
      expect(mainAddonEntries()).toEqual([]);
    } finally {
      if (before === undefined) {
        delete process.env.FLUIDEQ_NO_ADDONS;
      } else {
        process.env.FLUIDEQ_NO_ADDONS = before;
      }
    }
  });
});

describe('the main process’s add-on slot', () => {
  const services = () => {
    const error = jest.fn();
    return {
      error,
      services: {
        logger: { warn: jest.fn(), error },
      } as unknown as IMainAddonServices,
    };
  };

  afterEach(() => resetMainAddons());

  it('starts nothing when no add-on is registered', async () => {
    const started = startMainAddons(services().services);

    await expect(started.refreshIfDue('back')).resolves.toBeUndefined();
    expect(() => started.dispose()).not.toThrow();
  });

  it('keeps the app running past an add-on that fails to start', async () => {
    const dispose = jest.fn();
    const refreshIfDue = jest.fn(() => Promise.resolve());
    registerMainAddon('fluideq-test:broken', () => {
      throw new Error('no');
    });
    registerMainAddon('fluideq-test:working', () => ({
      dispose,
      refreshIfDue,
    }));
    const { error, services: given } = services();

    const started = startMainAddons(given);
    await started.refreshIfDue('unlocked');
    started.dispose();

    expect(error).toHaveBeenCalledWith(
      'The fluideq-test:broken add-on did not start',
      expect.any(Error),
    );
    expect(refreshIfDue).toHaveBeenCalledWith('unlocked');
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe('the window’s add-on door', () => {
  beforeEach(() => {
    invoke.mockClear();
    on.mockClear();
  });

  it('passes an add-on’s channel through', async () => {
    await expect(addonBridge.addonInvoke('addon:test-ask', 1)).resolves.toBe(
      'answered',
    );
    expect(invoke).toHaveBeenCalledWith('addon:test-ask', 1);
  });

  it('refuses every channel of the app’s own, before it is sent', async () => {
    await expect(addonBridge.addonInvoke('account-sign-out')).rejects.toThrow(
      'not an add-on channel',
    );
    addonBridge.onAddon('scene-store-changed', jest.fn())();

    expect(invoke).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
    expect(isAddonChannel('addon:')).toBe(false);
    expect(isAddonChannel('addon:Upper')).toBe(false);
  });

  it('hands an add-on’s listener its arguments, without the event', () => {
    const listener = jest.fn();
    const off = addonBridge.onAddon('addon:test-news', listener);
    const [[channel, subscription]] = on.mock.calls as [
      [string, (...args: unknown[]) => void],
    ];

    subscription({ sender: 'event' }, 'news', 2);
    off();

    expect(channel).toBe('addon:test-news');
    expect(listener).toHaveBeenCalledWith('news', 2);
    expect(removeListener).toHaveBeenCalledWith(
      'addon:test-news',
      subscription,
    );
  });
});
