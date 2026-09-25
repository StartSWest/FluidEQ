import { useEffect } from 'react';
import { mapSong } from 'common/songMap';
import type {
  IStudioAgentHearAsk,
  TStudioAgentHeardAnswer,
} from 'common/studioAgent';
import { heardSongs } from '../graph/heardSongs';
import { openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { drawForAgent } from './studioAgentDraw';
import { isStudioHeld } from './studioAgentHold';
import { markStudioAgentWorking } from './studioAgentSession';
import { selectStudioProject, studioActiveId } from './studioStore';

/**
 * The window's answers to the member's AI (`main/studioAgent/studioAgentDoor.ts`),
 * for the whole life of the page — not only while the Studio is showing,
 * because putting the Studio in front of the member is one of the answers.
 *
 * Three things are asked of it:
 *
 * - DRAW a scene main has already read and checked, off screen
 *   (`studioAgentDraw.ts`), and send the picture back.
 * - SHOW the project the AI is looking at: switch the Studio to it and bring
 *   the Studio up, the first time in a session the AI looks at that project,
 *   or whenever it looks at a project the Studio is not on. Never while the
 *   member is in the middle of something there (`studioAgentHold.ts`), and
 *   never again for a project already shown, so a member who walks away to
 *   the equaliser is not dragged back on every look.
 * - HEAR: the song playing, or the one before it, as this window heard it
 *   (`heardSongs.ts`), mapped (`songMap.ts`) for main to put into words.
 *
 * Either of the AI's asks says it is at work, and from then on the Studio
 * goes on hearing the music for it (`useSongListening.ts`).
 */

/** The song asked for, mapped, and how much of the other one was heard. */
const hearForAgent = ({
  song,
}: IStudioAgentHearAsk): TStudioAgentHeardAnswer => {
  const { now, before } = heardSongs.songs();
  const [asked, other] = song === 'before' ? [before, now] : [now, before];
  const otherSeconds = other.length > 0 ? other[other.length - 1].t : 0;
  return asked.length > 0
    ? { ok: true, map: mapSong(asked), otherSeconds }
    : { ok: false, reason: 'no-sound', otherSeconds };
};

export default function useStudioAgent() {
  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    if (!api?.onStudioAgentDraw || !api.studioAgentReady) {
      return undefined;
    }
    const shown = new Set<string>();
    const stopDraw = api.onStudioAgentDraw((ask) => {
      markStudioAgentWorking();
      drawForAgent(ask)
        .catch((error: unknown) => {
          console.error('Drawing a scene for the member AI failed:', error);
          return { ok: false as const, reason: 'unavailable' as const };
        })
        .then((answer) => api.studioAgentDrawn(ask.id, answer))
        .catch(() => undefined);
    });
    const stopShow = api.onStudioAgentShow((projectId) => {
      if (isStudioHeld()) {
        return;
      }
      const switching = studioActiveId() !== projectId;
      if (!switching && shown.has(projectId)) {
        return;
      }
      shown.add(projectId);
      if (switching) {
        selectStudioProject(projectId).catch(() => undefined);
      }
      requestPlusTab();
      openPlusPlace('studio');
    });
    // A preload from before hear_the_music has no way to be asked it, and
    // main is told so, so it never waits on an answer that cannot come.
    const stopHear = api.onStudioAgentHear?.((ask) => {
      markStudioAgentWorking();
      api.studioAgentHeard(ask.id, hearForAgent(ask)).catch(() => undefined);
    });
    api
      .studioAgentReady({ hears: stopHear !== undefined })
      .catch(() => undefined);
    return () => {
      stopDraw();
      stopShow();
      stopHear?.();
    };
  }, []);
}
