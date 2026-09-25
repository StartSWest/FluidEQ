import { useEffect, useState } from 'react';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { heardSongs } from '../graph/heardSongs';
import { useStudioAgentDoor } from './studioAgentDoorStore';
import { useStudioAgentWorking } from './studioAgentSession';
import { startSongListener, type ISongListener } from './songListener';

/**
 * The Studio hearing the music for the member's AI (hear_the_music).
 *
 * While the Studio is open, its door is and the AI has started working
 * (`studioAgentSession.ts`), every sample the capture plays is heard into the
 * songs kept for the AI (`songListener.ts`, `heardSongs.ts`) - with FluidEQ
 * behind the AI's own window, which is where it will be while the AI works,
 * or minimised. The capture is held as work for as long, which is what keeps
 * it running behind a hidden window. Closing the door, or leaving the
 * Studio, lets both go; nothing is kept from before the AI started.
 *
 * Says whether it is hearing, for the card to say so.
 */
export default function useSongListening(): boolean {
  const door = useStudioAgentDoor();
  const working = useStudioAgentWorking();
  const wanted = door?.open === true && working;
  useLiveAudioCapture(wanted, 'work');
  const { capture } = useLiveAudioControl();
  const [hearing, setHearing] = useState(false);

  useEffect(() => {
    if (!wanted || !capture) {
      return undefined;
    }
    const aborted = new AbortController();
    let listener: ISongListener | undefined;
    startSongListener(capture, heardSongs, aborted.signal)
      .then((started) => {
        if (aborted.signal.aborted) {
          started.close();
          return undefined;
        }
        listener = started;
        setHearing(true);
        return undefined;
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error(
            'The Studio could not hear the music for the member AI:',
            error,
          );
        }
      });
    return () => {
      aborted.abort();
      listener?.close();
      setHearing(false);
    };
  }, [wanted, capture]);

  return hearing;
}
