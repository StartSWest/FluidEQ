/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A game's sound, switched by the app's core: on when the game comes
 * forward, on the output Windows plays, a song's lent sound off first; kept
 * through every alt-tab; put back when the game's own process ends — and
 * only if the chain playing is still the game's — with a card in the
 * listener's language each way.
 */
import { getDefaultState, IState } from 'common/constants';
import { DSP_DEFAULTS, IDspSettings } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import { pickDspPreset } from 'common/dsp/presetPick';
import type { IKeptGames } from 'common/coreCopies';
import type { IGameProfile, IGameProgram } from 'common/games';
import { translate, type Translate } from 'common/i18n';
import type { IKeptFile } from 'core/files/keptFile';
import createMainSession from 'main/mainSession';
import { createGameSound } from 'main/gameSound';

jest.mock('electron-log', () => ({ error: jest.fn() }));

const t: Translate = (key, vars) => translate('en', key, vars);

const OVERWATCH: IGameProfile = {
  id: 'overwatch',
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch',
  source: 'battlenet',
  icon: 'data:image/png;base64,iVBORw0KGgo=',
  presetId: 'gaming',
};
const OVERWATCH_RUNNING: IGameProgram = {
  name: 'Overwatch',
  path: 'D:\\GAMES\\Overwatch\\_retail_\\Overwatch.exe',
  source: 'running',
  pid: 4242,
};
const CHROME: IGameProgram = {
  name: 'Google Chrome',
  path: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
  source: 'running',
  pid: 5150,
};

const rack = (id: string, enabled = true): IDspSettings => ({
  ...(dspPresetSettings(id, DSP_DEFAULTS) as IDspSettings),
  enabled,
});

const setUp = ({
  enabled = true,
  opens = true,
}: { enabled?: boolean; opens?: boolean } = {}) => {
  const state: IState = { ...getDefaultState(), dsp: rack('music') };
  const session = createMainSession();
  session.activeAudioDeviceId = 'main';
  let kept: IKeptGames = { enabled, profiles: [OVERWATCH] };
  const games: IKeptFile<IKeptGames> = {
    read: () => kept,
    keep: (next) => {
      kept = next;
      return true;
    },
    onChange: () => () => undefined,
  };
  const order: string[] = [];
  const deps = {
    state,
    session,
    games,
    savedChains: () => [],
    openPlayingOutput: jest.fn(async () => {
      order.push('open');
      return opens;
    }),
    // The core's own pick, its rules put straight on the output's rack.
    pick: jest.fn(async (id: string) => {
      order.push(`pick:${id}`);
      const picked = pickDspPreset({
        id,
        rack: state.dsp ?? DSP_DEFAULTS,
        voicing: state.voicing,
        saved: [],
        engine: 'fluid',
        quick: true,
      });
      if (picked) {
        state.dsp = picked.rack;
        state.voicing = picked.voicing;
      }
    }),
    songMemory: {
      yieldSound: jest.fn(async () => {
        order.push('yield');
      }),
      hold: jest.fn(),
      ownPresetId: jest.fn((current: string) => current),
    },
    holdProcess: jest.fn(),
    showCard: jest.fn(),
    tellWindow: jest.fn(),
    onPlaying: jest.fn(),
    t,
  };
  const sound = createGameSound(deps);
  return {
    state,
    deps,
    sound,
    order,
    switchOff: () => {
      kept = { ...kept, enabled: false };
    },
  };
};

describe('a game’s sound, switched by the core', () => {
  it('plays a game’s sound until the game ends, not until it loses the front', async () => {
    const { state, deps, sound } = setUp();
    await sound.heard(OVERWATCH_RUNNING);
    expect(state.dsp?.presetId).toBe('gaming');
    // Told the end of that very process, and says so on the desktop.
    expect(deps.holdProcess).toHaveBeenCalledWith(4242);
    expect(deps.showCard).toHaveBeenCalledWith({
      what: t('games.toast.loaded', { preset: 'Gaming' }),
      game: t('games.toast.forGame', { game: 'Overwatch' }),
      icon: OVERWATCH.icon,
    });
    expect(deps.tellWindow).toHaveBeenLastCalledWith({
      gameId: 'overwatch',
      presetId: 'gaming',
    });

    // Alt-tabbing out changes nothing.
    await sound.heard(CHROME);
    expect(state.dsp?.presetId).toBe('gaming');
    // The end of some other program is not the end of the game.
    await sound.ended(5150);
    expect(state.dsp?.presetId).toBe('gaming');

    // The game closing is what puts the sound back, and says so.
    await sound.ended(4242);
    expect(state.dsp?.presetId).toBe('music');
    expect(deps.showCard).toHaveBeenLastCalledWith({
      what: t('games.toast.restored', { preset: 'Music' }),
      game: t('games.toast.afterGame', { game: 'Overwatch' }),
      icon: OVERWATCH.icon,
    });
    expect(deps.tellWindow).toHaveBeenLastCalledWith(undefined);
  });

  it('goes back to the output Windows plays first, and takes the song’s sound off before its own goes on', async () => {
    const { deps, sound, order } = setUp();
    await sound.heard(OVERWATCH_RUNNING);
    expect(order).toEqual(['open', 'yield', 'pick:gaming']);
    expect(deps.songMemory.ownPresetId).toHaveBeenCalledWith('music');
  });

  it('changes nothing where the editor cannot get back to the playing output', async () => {
    const { state, deps, sound } = setUp({ opens: false });
    await sound.heard(OVERWATCH_RUNNING);
    expect(state.dsp?.presetId).toBe('music');
    expect(deps.pick).not.toHaveBeenCalled();
    expect(deps.showCard).not.toHaveBeenCalled();
  });

  it('puts back the listener’s own preset, never a song’s lent one', async () => {
    const { deps, sound } = setUp();
    deps.songMemory.ownPresetId.mockReturnValue('movie');
    await sound.heard(OVERWATCH_RUNNING);
    await sound.ended(4242);
    expect(deps.pick).toHaveBeenLastCalledWith('movie');
  });

  it('puts the rack back off after the game, and says so without naming a chain', async () => {
    const { state, deps, sound } = setUp();
    state.dsp = rack('music', false);
    await sound.heard(OVERWATCH_RUNNING);
    expect(state.dsp?.enabled).toBe(true);
    await sound.ended(4242);
    expect(deps.pick).toHaveBeenLastCalledWith('none');
    expect(state.dsp?.enabled).toBe(false);
    expect(deps.showCard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        what: t('games.toast.restoredNone'),
        game: t('games.toast.afterGame', { game: 'Overwatch' }),
      }),
    );
  });

  it('leaves a chain chosen during the game alone when the game ends, and says nothing', async () => {
    const { state, deps, sound } = setUp();
    await sound.heard(OVERWATCH_RUNNING);
    state.dsp = { ...rack('late-night') };
    await sound.ended(4242);
    expect(state.dsp.presetId).toBe('late-night');
    expect(deps.showCard).toHaveBeenCalledTimes(1);
  });

  it('leaves the sound and the editor alone for a program with no profile, and says nothing', async () => {
    const { state, deps, sound } = setUp();
    await sound.heard(CHROME);
    expect(state.dsp?.presetId).toBe('music');
    expect(deps.showCard).not.toHaveBeenCalled();
    expect(deps.onPlaying).toHaveBeenLastCalledWith(false);
    // Not pulled back to the playing output for an alt-tab.
    expect(deps.openPlayingOutput).not.toHaveBeenCalled();
    // POSITIVE CONTROL: a game of the listener's does go back there.
    await sound.heard(OVERWATCH_RUNNING);
    expect(deps.openPlayingOutput).toHaveBeenCalledTimes(1);
  });

  it('holds the desktop backgrounds while one of the listener’s games is in front', async () => {
    const { deps, sound } = setUp();
    await sound.heard(OVERWATCH_RUNNING);
    expect(deps.onPlaying).toHaveBeenLastCalledWith(true);
    await sound.heard(CHROME);
    expect(deps.onPlaying).toHaveBeenLastCalledWith(false);
  });

  it('holds the song memory off while the game’s chain plays, and lets go once the listener picks another', async () => {
    const { state, deps, sound } = setUp();
    await sound.heard(OVERWATCH_RUNNING);
    expect(deps.songMemory.hold).toHaveBeenLastCalledWith(true);
    state.dsp = { ...rack('late-night') };
    sound.soundMayHaveChanged();
    expect(deps.songMemory.hold).toHaveBeenLastCalledWith(false);
  });

  it('switched off, no game reaches the sound', async () => {
    const { state, deps, sound } = setUp({ enabled: false });
    await sound.heard(OVERWATCH_RUNNING);
    expect(state.dsp?.presetId).toBe('music');
    expect(deps.holdProcess).not.toHaveBeenCalled();
    expect(deps.onPlaying).toHaveBeenLastCalledWith(false);
  });

  it('puts the sound from before back when switched off during a game, with no card', async () => {
    const { state, deps, sound, switchOff } = setUp();
    await sound.heard(OVERWATCH_RUNNING);
    expect(deps.showCard).toHaveBeenCalledTimes(1);
    switchOff();
    await sound.gamesChanged();
    expect(state.dsp?.presetId).toBe('music');
    expect(deps.holdProcess).toHaveBeenLastCalledWith(0);
    expect(deps.showCard).toHaveBeenCalledTimes(1);
    expect(deps.tellWindow).toHaveBeenLastCalledWith(undefined);
    // POSITIVE CONTROL: a change of list with the switch on lets nothing go.
    const other = setUp();
    await other.sound.heard(OVERWATCH_RUNNING);
    await other.sound.gamesChanged();
    expect(other.state.dsp?.presetId).toBe('gaming');
  });
});
