/**
 * The amp's words and numbers: the folded line's clock and its state, where
 * the sound is from, and how long the queue has left.
 */

import en from 'common/i18n/en';
import type { ITransportSource } from 'renderer/audio/transportSource';
import {
  clockFor,
  formatQueueTime,
  playerStateOf,
  sourceLabel,
} from 'renderer/player/playerText';

const t = (key: keyof typeof en, vars?: Record<string, string | number>) =>
  Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    en[key] as string,
  );

const source = (overrides: Partial<ITransportSource>): ITransportSource =>
  ({
    owner: 'library',
    title: 'Gone',
    subtitle: 'N’Sync',
    durationMs: 294_000,
    positionMs: 17_000,
    isPlaying: true,
    toggle: () => undefined,
    ...overrides,
  }) as ITransportSource;

describe('what the clock reads', () => {
  it('counts up by default, and down with a minus in front when turned round', () => {
    const at = { shownMs: 17_000, durationMs: 294_000, isKnown: true };
    expect(clockFor({ ...at, isTimeLeft: false })).toBe('0:17');
    expect(clockFor({ ...at, isTimeLeft: true })).toBe('−4:37');
  });

  it('never counts down past the end', () => {
    expect(
      clockFor({
        shownMs: 300_000,
        durationMs: 294_000,
        isTimeLeft: true,
        isKnown: true,
      }),
    ).toBe('−0:00');
  });

  it('is dashes for a source with no position or no length', () => {
    expect(
      clockFor({
        shownMs: 0,
        durationMs: 0,
        isTimeLeft: false,
        isKnown: true,
      }),
    ).toBe('–:––');
    expect(
      clockFor({
        shownMs: 0,
        durationMs: 294_000,
        isTimeLeft: true,
        isKnown: false,
      }),
    ).toBe('–:––');
  });
});

describe('the state the folded line shows', () => {
  it('is play while playing, pause once into a song, stop at its head', () => {
    expect(playerStateOf(source({ isPlaying: true }), 17)).toBe('play');
    expect(playerStateOf(source({ isPlaying: false }), 17)).toBe('pause');
    expect(playerStateOf(source({ isPlaying: false }), 0)).toBe('stop');
    expect(playerStateOf(undefined, undefined)).toBe('stop');
  });
});

describe('the source’s name', () => {
  it('names each owner the way the app’s own tabs do', () => {
    expect(sourceLabel(source({ owner: 'library' }), t)).toBe(
      en['tabs.library'],
    );
    expect(sourceLabel(source({ owner: 'karaoke' }), t)).toBe(
      en['tabs.karaoke'],
    );
    expect(sourceLabel(source({ owner: 'media' }), t)).toBe(en['tabs.media']);
    expect(sourceLabel(source({ owner: 'system' }), t)).toBe(
      en['library.systemAudio'],
    );
    expect(sourceLabel(source({ owner: 'remote', origin: 'Laptop' }), t)).toBe(
      t('library.remoteAudio', { name: 'Laptop' }),
    );
  });

  it('says how far behind another computer’s sound plays, once that is known', () => {
    expect(
      sourceLabel(
        source({ owner: 'remote', origin: 'SWEST-YOGA', delayMs: 144.6 }),
        t,
      ),
    ).toBe('Playing remote · SWEST-YOGA · 145 ms');
    // POSITIVE CONTROL: only another computer's sound carries one.
    expect(sourceLabel(source({ owner: 'library', delayMs: 145 }), t)).toBe(
      en['tabs.library'],
    );
  });
});

describe('how long the queue has left', () => {
  it('reads as a song’s length under an hour, and with the hours past one', () => {
    expect(formatQueueTime(14 * 60_000)).toBe('14:00');
    expect(formatQueueTime(59 * 60_000 + 59_900)).toBe('59:59');
    expect(formatQueueTime(3_600_000)).toBe('1:00:00');
    expect(formatQueueTime(2 * 3_600_000 + 5 * 60_000 + 7_000)).toBe('2:05:07');
  });

  it('writes nothing for a length below zero, rather than a negative time', () => {
    expect(formatQueueTime(-5_000)).toBe('');
  });
});
