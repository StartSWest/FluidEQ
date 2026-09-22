import en from 'common/i18n/en';
import type { ITransportSource } from 'renderer/audio/transportSource';
import { clockText } from 'renderer/player/LedClock';
import {
  clockFor,
  nowPlayingLine,
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

describe('the LED clock’s five cells', () => {
  it('shows minutes and seconds with a blank sign, and a minus counting down', () => {
    expect(clockText(17, false)).toBe(' 0017');
    expect(clockText(277, true)).toBe('-0437');
    expect(clockText(3599.9, false)).toBe(' 5959');
  });

  it('shows four dashes when there is nothing to count', () => {
    expect(clockText(undefined, false)).toBe(' ----');
    expect(clockText(Number.NaN, true)).toBe(' ----');
  });

  it('never runs past two digits of minutes', () => {
    expect(clockText(100 * 60 + 5, false)).toBe(' 9905');
  });
});

describe('what the clock reads', () => {
  it('counts up by default and down when turned round', () => {
    const at = { shownMs: 17_000, durationMs: 294_000, isKnown: true };
    expect(clockFor({ ...at, isTimeLeft: false })).toBe(' 0017');
    expect(clockFor({ ...at, isTimeLeft: true })).toBe('-0437');
  });

  it('is dashes for a source with no position or no length', () => {
    expect(
      clockFor({
        shownMs: 0,
        durationMs: 0,
        isTimeLeft: false,
        isKnown: true,
      }),
    ).toBe(' ----');
    expect(
      clockFor({
        shownMs: 0,
        durationMs: 294_000,
        isTimeLeft: true,
        isKnown: false,
      }),
    ).toBe(' ----');
  });
});

describe('the line across the display', () => {
  it('is artist, title and length', () => {
    expect(nowPlayingLine(source({}), 'nothing')).toBe('N’Sync — Gone (4:54)');
  });

  it('leaves out what a source does not know', () => {
    expect(
      nowPlayingLine(source({ subtitle: undefined, durationMs: 0 }), 'x'),
    ).toBe('Gone');
    expect(nowPlayingLine(undefined, 'Nothing playing')).toBe(
      'Nothing playing',
    );
  });
});

describe('the state lamp', () => {
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
});
