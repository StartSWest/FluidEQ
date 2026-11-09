import type { ComponentProps } from 'react';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
import useQuietDemoAudio from '../audio/useQuietDemoAudio';
import StudioStage from './StudioStage';
import { listensToMusic } from './studioSignals';

/**
 * The stage on the music playing, or, while nothing plays, on the demo song
 * without a sound, as the Gallery's preview does (Ivan, 2026-11-09: "also in
 * the studio I want playing with demo data if no sound"), with the stage
 * saying so. Music heard, or a player saying it plays, takes over at once.
 *
 * Only under the signals that listen to the music: Your music, and Bass, Mids
 * and Treble, which hear their part of whatever Your music hears - the stage
 * and its meters read one source, so the bass under Bass is the bass under
 * Your music, demo or not. The made-up signals replace every measurement and
 * keep no demo running under them.
 */
export default function StudioStageSound({
  signal,
  ...stage
}: Omit<ComponentProps<typeof StudioStage>, 'demo'>) {
  const { audio, demo } = useQuietDemoAudio(listensToMusic(signal));
  return (
    <SceneAudioProvider value={audio}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading -- every one of the stage's own props, passed on unchanged */}
      <StudioStage {...stage} signal={signal} demo={demo} />
    </SceneAudioProvider>
  );
}
