/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One of the machine's own programs at a time, kept by main beside the
 * watcher so it holds with no window at all (`systemMediaRule.ts`).
 */
import type { ISystemMediaSnapshot } from '../../../main/systemMedia';
import {
  createExternalPlayerRule,
  startedOverOthers,
} from '../../../main/systemMediaRule';

describe('one of the machine’s own programs at a time', () => {
  const playing = (...apps: string[]) => new Set(apps);

  it('is the one that started over what was already playing', () => {
    // Spotify going, a Netflix tab clicked: the tab keeps the sound and
    // Spotify is asked to stop. Neither of them is this app's, which is why
    // nothing stopped either of them before.
    expect(
      startedOverOthers(playing('Spotify.exe'), ['Spotify.exe', 'Chrome']),
    ).toBe('Chrome');
  });

  it('is nobody while the same programs keep playing', () => {
    // Windows republishes a player's state when nothing has happened. Read as
    // a state rather than a change, that stops the album somebody is
    // listening to because the app blinked.
    expect(
      startedOverOthers(playing('Spotify.exe', 'Chrome'), [
        'Spotify.exe',
        'Chrome',
      ]),
    ).toBeUndefined();
  });

  it('is nobody when one program starts with nothing to stop', () => {
    expect(startedOverOthers(playing(), ['Spotify.exe'])).toBeUndefined();
  });

  it('is nobody for what was already going when this app opened', () => {
    // The first reading of the machine: two programs playing, nobody having
    // pressed anything, and no way to tell which is the newer. Silencing one
    // of them for opening an equaliser is a decision nobody asked for.
    expect(
      startedOverOthers(playing(), ['Spotify.exe', 'Chrome']),
    ).toBeUndefined();
  });

  it('is nobody when a program stops', () => {
    expect(
      startedOverOthers(playing('Spotify.exe', 'Chrome'), ['Chrome']),
    ).toBeUndefined();
  });
});

describe('the rule as the watcher reads it', () => {
  const reading = (...apps: string[]): ISystemMediaSnapshot => ({
    app: apps[0] ?? '',
    title: 'Song',
    artist: 'Band',
    isPlaying: apps.length > 0,
    positionMs: 0,
    durationMs: 0,
    canNext: false,
    canPrevious: false,
    canSeek: false,
    playing: apps,
    coverId: '',
  });

  it('quietens the album when a video is started over it', () => {
    const pauseOthers = jest.fn(() => Promise.resolve());
    const rule = createExternalPlayerRule(pauseOthers);

    rule.heard(reading('Spotify.exe'));
    expect(pauseOthers).not.toHaveBeenCalled();

    rule.heard(reading('Spotify.exe', 'Chrome'));
    expect(pauseOthers).toHaveBeenCalledWith('Chrome');

    // And not again while the same one keeps playing: the watcher reports a
    // moving position, and every one of those readings still says playing.
    pauseOthers.mockClear();
    rule.heard(reading('Spotify.exe', 'Chrome'));
    expect(pauseOthers).not.toHaveBeenCalled();
  });

  it('remembers between readings, not from the first one', () => {
    // The watcher's first reading after a launch finds both going.
    const pauseOthers = jest.fn(() => Promise.resolve());
    const rule = createExternalPlayerRule(pauseOthers);
    rule.heard(reading('Spotify.exe', 'Chrome'));
    expect(pauseOthers).not.toHaveBeenCalled();
  });

  it('leaves both alone when one player at a time is switched off', () => {
    const pauseOthers = jest.fn(() => Promise.resolve());
    const rule = createExternalPlayerRule(pauseOthers);
    rule.setSinglePlayer(false);
    rule.heard(reading('Spotify.exe'));
    rule.heard(reading('Spotify.exe', 'Chrome'));
    expect(pauseOthers).not.toHaveBeenCalled();

    // Switched back on, the next start is acted on.
    rule.setSinglePlayer(true);
    rule.heard(reading('Spotify.exe', 'Chrome', 'vlc.exe'));
    expect(pauseOthers).toHaveBeenCalledWith('vlc.exe');
  });

  it('carries on when Windows will not pause a program', async () => {
    const pauseOthers = jest.fn(() => Promise.reject(new Error('refused')));
    const rule = createExternalPlayerRule(pauseOthers);
    rule.heard(reading('Spotify.exe'));
    rule.heard(reading('Spotify.exe', 'Chrome'));
    await Promise.resolve();
    rule.heard(reading('Chrome'));
    rule.heard(reading('Chrome', 'vlc.exe'));
    expect(pauseOthers).toHaveBeenCalledTimes(2);
  });
});
