/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
} from '../../common/karaoke/makerProject';
import { useTranslation } from '../utils/I18nContext';
import { plainLyrics } from './useKaraokeMakerLyricsDraft';

/**
 * The original, read-only and numbered, to paste a translation alongside.
 *
 * Third of `KaraokeMakerLyricsDialog`'s views — shown instead of
 * `KaraokeMakerLyricsWordList` whenever the paste view's target is a
 * translation rather than the original, since the word-timing panel is
 * specific to the original's own tapped/detected timing and has nothing to
 * show for a sheet that has not been pasted yet.
 *
 * The mismatch banner lives here rather than beside it, so the numbers it
 * quotes and the numbered lines a user checks them against never end up in
 * two different components that could each render on their own.
 */
export interface IKaraokeMakerLyricsReferenceViewProps {
  project: IKaraokeMakerProject;
  /** Set when the last paste attempt disagreed with the original on line
   * count. Undefined the rest of the time — including the first look at a
   * fresh translation, which is not an error state. */
  mismatch: { expected: number; received: number } | undefined;
}

const KaraokeMakerLyricsReferenceView = ({
  mismatch,
  project,
}: IKaraokeMakerLyricsReferenceViewProps) => {
  const { t } = useTranslation();

  // One text entry per `project.lyrics.lines` entry, in the same order:
  // `plainLyrics` already builds exactly that, newline-joined, so splitting
  // it back apart recovers each line's words without a second token-join
  // here. Section headings consume no *pasted* line — `seedKaraokeTranslation`
  // filters them out before counting — so they carry no number either, or a
  // user counting rows against the mismatch message would arrive at a
  // different number than the code did.
  const originalLineRows = useMemo(() => {
    const texts = plainLyrics(project).split('\n');
    let lyricNumber = 0;
    return project.lyrics.lines.map((line, index) => {
      const isSection = karaokeMakerLineIsSection(line);
      if (!isSection) {
        lyricNumber += 1;
      }
      return {
        id: line.id,
        text: texts[index] ?? '',
        isSection,
        number: isSection ? undefined : lyricNumber,
      };
    });
  }, [project]);

  return (
    <section className="karaoke-maker__lyrics-reference">
      <div className="karaoke-maker__lyrics-reference-head">
        <div className="karaoke-maker__lyrics-section-head">
          <strong>{t('karaoke.maker.referenceLyrics')}</strong>
        </div>
        {mismatch && (
          <p className="karaoke-maker__translation-mismatch" role="status">
            {t('karaoke.translation.mismatch', {
              expected: mismatch.expected,
              received: mismatch.received,
            })}
          </p>
        )}
      </div>
      <div className="karaoke-maker__lyrics-token-scroll">
        {originalLineRows.map((row) => (
          <div
            key={row.id}
            className={`karaoke-maker__lyrics-token-line${
              row.isSection ? ' is-section' : ''
            }`}
          >
            {row.isSection ? (
              <span>{row.text}</span>
            ) : (
              <>
                <span className="karaoke-maker__lyrics-line-number">
                  {row.number}
                </span>
                <span>{row.text}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default KaraokeMakerLyricsReferenceView;
