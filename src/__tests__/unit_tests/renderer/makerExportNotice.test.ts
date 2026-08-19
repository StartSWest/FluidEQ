/* FluidEQ Karaoke Maker export notice. GPL-3.0-or-later. */

import { translate } from '../../../common/i18n';
import { IKaraokeMakerExport } from '../../../common/karaoke/makerExport';
import { karaokeExportNotice } from '../../../renderer/karaoke/useMakerProjectFiles';

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

const written = (parts: Partial<IKaraokeMakerExport>): IKaraokeMakerExport => ({
  format: 'lrc',
  extension: 'lrc',
  mimeType: 'text/plain',
  contents: '',
  droppedLines: 0,
  droppedWords: 0,
  ...parts,
});

describe('the sentence an export ends on', () => {
  it('reports a complete file as a plain success', () => {
    expect(karaokeExportNotice(written({}), 'C:\\songs\\Song.lrc', t)).toBe(
      t('karaoke.maker.exported', { file: 'C:\\songs\\Song.lrc' }),
    );
  });

  it('says what LRC could not carry, in lines', () => {
    // The counters existed and nothing read them: this file and a complete one
    // both said `Exported <path>`.
    const notice = karaokeExportNotice(
      written({ droppedLines: 3, droppedWords: 11 }),
      'Song.lrc',
      t,
    );

    expect(notice).toBe(
      t('karaoke.maker.exportedPartialLrc', { file: 'Song.lrc', lines: 3 }),
    );
    expect(notice).toContain('3');
    expect(notice).not.toBe(t('karaoke.maker.exported', { file: 'Song.lrc' }));
  });

  it('says what UltraStar could not carry, in words', () => {
    // A different unit, because the two formats lose different things: LRC
    // drops a line it cannot time, UltraStar drops a word with no note.
    const notice = karaokeExportNotice(
      written({ format: 'ultrastar', droppedLines: 0, droppedWords: 4 }),
      'Song.txt',
      t,
    );

    expect(notice).toBe(
      t('karaoke.maker.exportedPartialUltraStar', {
        file: 'Song.txt',
        words: 4,
      }),
    );
    expect(notice).not.toBe(
      t('karaoke.maker.exportedPartialLrc', { file: 'Song.txt', lines: 0 }),
    );
  });

  it('keeps enhanced LRC on the LRC sentence', () => {
    expect(
      karaokeExportNotice(
        written({ format: 'elrc', extension: 'elrc', droppedLines: 1 }),
        'Song.elrc',
        t,
      ),
    ).toBe(
      t('karaoke.maker.exportedPartialLrc', { file: 'Song.elrc', lines: 1 }),
    );
  });

  it('speaks the reader’s language rather than English', () => {
    expect(
      karaokeExportNotice(
        written({ droppedLines: 2 }),
        'Song.lrc',
        (key, vars) => translate('ja', key, vars),
      ),
    ).toBe(
      translate('ja', 'karaoke.maker.exportedPartialLrc', {
        file: 'Song.lrc',
        lines: 2,
      }),
    );
  });
});
