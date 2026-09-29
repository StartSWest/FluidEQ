/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type SetStateAction, useEffect } from 'react';
import { extractKaraokeMakerWaveform } from './makerAnalysis';
import { type IKaraokeSong } from '../../common/karaoke/types';
import { type Translate } from '../../common/i18n';

interface IMakerStemLanesInput {
  song: IKaraokeSong;
  analysisFile: File;
  audioFile: File;
  setAnalysisFile: Dispatch<SetStateAction<File>>;
  instrumental: File | undefined;
  setStemWaveforms: Dispatch<
    SetStateAction<
      | {
          vocals: number[];
          instrumental: number[];
          labels: { mix: string; backing: string; voice: string };
        }
      | undefined
    >
  >;
  t: Translate;
}

/**
 * The two stems the editor draws under the song: stems a song already
 * carries are adopted as the analysis audio, and once both halves of a
 * split exist their overview waves are read for the canvas.
 */
const useMakerStemLanes = ({
  song,
  analysisFile,
  audioFile,
  setAnalysisFile,
  instrumental,
  setStemWaveforms,
  t,
}: IMakerStemLanesInput) => {
  // Stems restored from disk arrive on the song, not in this editor's state.
  // Without adopting them the Maker reopens with `analysisFile` back at the
  // full mix: lyric detection sits disabled behind "separate first" for a song
  // that was separated yesterday — which is indistinguishable from broken.
  const restoredVocals = song.assets.find(
    (asset) => asset.role === 'vocals',
  )?.file;
  const restoredInstrumental = song.assets.find(
    (asset) => asset.role === 'instrumental',
  )?.file;
  useEffect(() => {
    if (restoredVocals && analysisFile === audioFile) {
      setAnalysisFile(restoredVocals);
    }
  }, [restoredVocals, analysisFile, audioFile, setAnalysisFile]);
  const effectiveInstrumental = instrumental ?? restoredInstrumental;

  const stemVocalsFile = analysisFile === audioFile ? undefined : analysisFile;
  useEffect(() => {
    let cancelled = false;
    if (!effectiveInstrumental || !stemVocalsFile) {
      setStemWaveforms(undefined);
      return undefined;
    }
    (async () => {
      const [vocalsWave, instrumentalWave] = await Promise.all([
        extractKaraokeMakerWaveform(stemVocalsFile),
        extractKaraokeMakerWaveform(effectiveInstrumental),
      ]);
      if (!cancelled) {
        setStemWaveforms({
          vocals: vocalsWave.waveform,
          instrumental: instrumentalWave.waveform,
          // Reusing the names the rest of the app already localizes: the
          // fader's "Original" endpoint and the stem rows' track names.
          labels: {
            mix: t('karaoke.transport.vocalFull'),
            backing: t('karaoke.maker.stemBacking'),
            voice: t('karaoke.maker.stemVoice'),
          },
        });
      }
    })().catch(() => {
      // No lanes rather than a broken canvas; the editor works without them.
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveInstrumental, setStemWaveforms, stemVocalsFile, t]);

  return { effectiveInstrumental, stemVocalsFile };
};

export default useMakerStemLanes;
