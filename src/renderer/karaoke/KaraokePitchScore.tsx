/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback } from 'react';
import { formatKaraokeTime } from '../../common/karaoke/clock';
import { type IKaraokeScoreLine } from '../../common/karaoke/scoring';
import { type IKaraokeSong } from '../../common/karaoke/types';
import { type IKaraokePitchIssue } from './karaokePitchGeometry';
import { KaraokeLiveValue } from './karaokeLiveValue';
import KaraokePitchLane from './KaraokePitchLane';
import KaraokeScoreCard from './KaraokeScoreCard';
import KaraokeScoreLines from './KaraokeScoreLines';
import { type TKaraokeMicrophoneInput } from './useKaraokeMicrophone';
import useKaraokeScore from './useKaraokeScore';
import { type TKaraokePlaybackStatus } from './useKaraokeSession';

/**
 * How far before a line's first note "sing it again" lands: past the
 * count-in, the singer still needs a breath before the first syllable, and a
 * line entered on its very first note always heard that note late.
 */
const LINE_LEAD_IN_MS = 800;

interface IKaraokePitchScoreProps {
  song: IKaraokeSong;
  status: TKaraokePlaybackStatus;
  microphone: Pick<
    TKaraokeMicrophoneInput,
    'livePitch' | 'pitchAnalysisStatus' | 'status' | 'toggle'
  >;
  isActive: boolean;
  durationMs: number;
  readPlayheadMs: () => number;
  onPracticeIssue: (issue: IKaraokePitchIssue) => void;
  onScrubStart: () => void;
  onScrub: (timeMs: number) => void;
  onScrubEnd: (timeMs: number) => void;
  /** Back to a moment of the song with the count-in, to sing from there. */
  onSingFrom: (timeMs: number) => void;
  onSingAgain: () => void;
  /** A picture behind the strip (`KaraokePitchLane`'s). */
  overPicture?: boolean;
}

/**
 * The pitch strip with the singer's score on it and under it: each note's
 * verdict on the strip as it ends, the lines as rows of cells under it with
 * the running score, and the card at the end of the song.
 */
const KaraokePitchScore = ({
  song,
  status,
  microphone,
  isActive,
  durationMs,
  readPlayheadMs,
  onPracticeIssue,
  onScrubStart,
  onScrub,
  onScrubEnd,
  onSingFrom,
  onSingAgain,
  overPicture,
}: IKaraokePitchScoreProps) => {
  const {
    sheet,
    snapshot,
    isListening,
    readVerdict,
    endCard,
    hasEndCard,
    closeEndCard,
    openEndCard,
  } = useKaraokeScore({
    song,
    livePitch: microphone.livePitch,
    microphoneStatus: microphone.status,
    status,
    readPlayheadMs,
    isActive,
  });
  const practiseLine = useCallback(
    (line: IKaraokeScoreLine) => {
      closeEndCard();
      onSingFrom(Math.max(0, line.startMs - LINE_LEAD_IN_MS));
    },
    [closeEndCard, onSingFrom],
  );
  const singAgain = useCallback(() => {
    closeEndCard();
    onSingAgain();
  }, [closeEndCard, onSingAgain]);
  const hasVerdicts = snapshot.results.some(
    (result) => result !== undefined && result.verdict !== 'skipped',
  );

  return (
    <>
      {/* No playhead here: the lane reads the element itself every frame,
          and re-renders only for the pitch it prints. */}
      <KaraokeLiveValue value={microphone.livePitch}>
        {(pitch) => (
          <KaraokePitchLane
            isActive={isActive}
            isPlaying={status === 'playing'}
            pitch={pitch}
            analysisStatus={microphone.pitchAnalysisStatus}
            microphoneStatus={microphone.status}
            onToggleMicrophone={microphone.toggle}
            target={song.pitch}
            durationMs={durationMs}
            readPlayheadMs={readPlayheadMs}
            onPracticeIssue={onPracticeIssue}
            onScrubStart={onScrubStart}
            onScrub={onScrub}
            onScrubEnd={onScrubEnd}
            readVerdict={sheet ? readVerdict : undefined}
            overPicture={overPicture}
          />
        )}
      </KaraokeLiveValue>
      {/* While the microphone listens, and after, while there is something
          it judged to show; a song nobody sang to keeps the slim strip. */}
      {sheet && (isListening || hasVerdicts) && (
        <KaraokeScoreLines
          sheet={sheet}
          snapshot={snapshot}
          onPractiseLine={practiseLine}
          onOpenReport={hasEndCard ? openEndCard : undefined}
        />
      )}
      {endCard && (
        <KaraokeScoreCard
          card={endCard}
          songLabel={
            durationMs > 0
              ? `${song.title} · ${formatKaraokeTime(durationMs)}`
              : song.title
          }
          onClose={closeEndCard}
          onPractiseLine={practiseLine}
          onSingAgain={singAgain}
        />
      )}
    </>
  );
};

export default KaraokePitchScore;
