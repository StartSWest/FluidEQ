/* FluidEQ karaoke import notices. GPL-3.0-or-later. */

import { translate } from '../../../common/i18n';
import { IKaraokePlaylistSelection } from '../../../common/karaoke/files';
import {
  karaokeLyricWarningSentence,
  karaokeSetAsideFiles,
  karaokeSetAsideSentences,
} from '../../../renderer/karaoke/karaokeImportNotices';

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const file = (name: string): File => new File(['x'], name);

const selection = (
  parts: Partial<IKaraokePlaylistSelection>,
): IKaraokePlaylistSelection => ({
  items: [],
  ignored: [],
  unpairedLyrics: [],
  ambiguousLyrics: [],
  ...parts,
});

describe('set-aside files', () => {
  it('says nothing when the import used everything it was given', () => {
    expect(karaokeSetAsideFiles(selection({}))).toBeUndefined();
  });

  it('keeps the cover out of the ignored formats', () => {
    // The stage is showing that picture behind the words at the moment the
    // notice would name it as dropped.
    const found = karaokeSetAsideFiles(
      selection({
        ignored: [file('cover.jpg'), file('clip.avi'), file('song.cdg')],
      }),
    );

    expect(found?.formats).toEqual(['CDG']);
  });

  it('reports the formats it has no reader for', () => {
    // Positive control for the filter above: a subtitle file is neither
    // picture nor video, so it must survive into the list.
    const found = karaokeSetAsideFiles(
      selection({ ignored: [file('a.srt'), file('b.SRT'), file('c.cdg')] }),
    );

    // De-duplicated and case-folded, so nine subtitles are one word.
    expect(found?.formats).toEqual(['CDG', 'SRT']);
  });
});

describe('the set-aside sentences', () => {
  const names = (count: number, extension: string): File[] =>
    Array.from({ length: count }).map((_unused, index) =>
      file(`Song ${index + 1}.${extension}`),
    );

  it('names a handful of files in full', () => {
    const sentences = karaokeSetAsideSentences(
      { formats: [], unpaired: ['Song 1.lrc', 'Song 2.lrc'], ambiguous: [] },
      t,
    );

    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain('Song 1.lrc, Song 2.lrc');
    expect(sentences[0]).not.toContain('more');
  });

  it('stops naming files once a folder import runs away with the strip', () => {
    const found = karaokeSetAsideFiles(
      selection({ unpairedLyrics: names(50, 'lrc') }),
    );
    if (!found) {
      throw new Error('fifty unpaired lyric files should have been reported');
    }
    const sentence = karaokeSetAsideSentences(found, t)[0];

    // Six names, then a count — not fifty filenames in one warning strip.
    expect(sentence).toContain('Song 6.lrc');
    expect(sentence).not.toContain('Song 7.lrc');
    expect(sentence).toContain(t('karaoke.warning.andMore', { count: 44 }));
    // The tail goes through i18n rather than being spelled out in English.
    expect(translate('es', 'karaoke.warning.andMore', { count: 44 })).toBe(
      'y 44 más',
    );
  });

  it('gives each kind of leftover its own sentence', () => {
    const sentences = karaokeSetAsideSentences(
      {
        formats: ['CDG'],
        unpaired: ['Song 1.lrc'],
        ambiguous: ['Song 2.lrc', 'Song 2.txt'],
      },
      t,
    );

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toContain('CDG');
    expect(sentences[1]).toContain('Song 1.lrc');
    expect(sentences[2]).toContain('Song 2.txt');
  });
});

describe('the lyric warning sentence', () => {
  it('says which failure the parser reported', () => {
    expect(karaokeLyricWarningSentence({ code: 'missing-bpm' }, t)).toBe(
      t('karaoke.warning.lyricsMissingBpm'),
    );
    // Positive control: a different code is a different sentence, so the map
    // is being read rather than one string returned for everything.
    expect(karaokeLyricWarningSentence({ code: 'empty' }, t)).not.toBe(
      t('karaoke.warning.lyricsMissingBpm'),
    );
  });

  it('falls back to the generic line when the parser named nothing', () => {
    expect(karaokeLyricWarningSentence({}, t)).toBe(
      t('karaoke.warning.lyrics'),
    );
  });

  it('appends the line number only when there is one', () => {
    expect(
      karaokeLyricWarningSentence({ code: 'malformed-note', line: 42 }, t),
    ).toContain('42');
    expect(
      karaokeLyricWarningSentence({ code: 'malformed-note' }, t),
    ).not.toContain('Line');
  });
});
