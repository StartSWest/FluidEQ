/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The words on the Stage's sound path (`PlayerPath.tsx`): where the sound
 * comes from in one word, and a file's format as a tag beside it only when
 * the format has a short name.
 */

import en from 'common/i18n/en';
import { codecTag, sourceShortLabel } from 'renderer/player/playerText';

const t = (key: keyof typeof en) => en[key] as string;

describe('where the sound comes from, in a word', () => {
  it('names each owner the way the app’s own tabs do', () => {
    expect(sourceShortLabel({ owner: 'library' }, t)).toBe(en['tabs.library']);
    expect(sourceShortLabel({ owner: 'karaoke' }, t)).toBe(en['tabs.karaoke']);
    expect(sourceShortLabel({ owner: 'system' }, t)).toBe(
      en['library.systemAudio'],
    );
    expect(sourceShortLabel({ owner: 'media' }, t)).toBe(en['tabs.mediaShort']);
  });

  it('names a shared stream by where it comes from, and Share without one', () => {
    expect(
      sourceShortLabel({ owner: 'remote', origin: 'Living room' }, t),
    ).toBe('Living room');
    expect(sourceShortLabel({ owner: 'remote', origin: '  ' }, t)).toBe(
      en['tabs.share'],
    );
    expect(sourceShortLabel({ owner: 'remote' }, t)).toBe(en['tabs.share']);
  });
});

describe('a file’s format beside it', () => {
  it('keeps the short names, in capitals', () => {
    expect(codecTag('FLAC')).toBe('FLAC');
    expect(codecTag('aac')).toBe('AAC');
    expect(codecTag(' Opus ')).toBe('OPUS');
    expect(codecTag('ALAC')).toBe('ALAC');
    expect(codecTag('PCM')).toBe('PCM');
  });

  // Beside one word, "MPEG 1 Layer 3" read as a sentence.
  it('leaves out a format with no short name, and no format at all', () => {
    expect(codecTag('MPEG 1 Layer 3')).toBeUndefined();
    expect(codecTag('Vorbis I')).toBeUndefined();
    expect(codecTag('X')).toBeUndefined();
    expect(codecTag('')).toBeUndefined();
    expect(codecTag(undefined)).toBeUndefined();
  });
});
