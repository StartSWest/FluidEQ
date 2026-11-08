import { useEffect } from 'react';
import { mapSong } from 'common/songMap';
import type {
  IStudioAgentHearAsk,
  TStudioAgentHeardAnswer,
} from 'common/studioAgent';
import { heardSongs } from '../graph/heardSongs';
import { drawForAgent } from './studioAgentDraw';
import { markStudioAgentWorking } from './studioAgentSession';

/**
 * The window's answers to the member's AI (`main/studioAgent/studioAgentDoor.ts`),
 * for the whole life of the page — not only while the Studio is showing,
 * because the AI works whatever page the member is on.
 *
 * Two things are asked of it:
 *
 * - DRAW a scene main has already read and checked, off screen
 *   (`studioAgentDraw.ts`), and send the picture back.
 * - HEAR: the song playing, or the one before it, as this window heard it
 *   (`heardSongs.ts`), mapped (`songMap.ts`) for main to put into words.
 *
 * A look never moves the Studio (Ivan, 2026-11-07: "when an agent take pic
 * it should not jump into that scene ... so I can work on multiple scenes at
 * the same time"). It used to switch the Studio to the project looked at and
 * bring the Studio up; with a chat at work on each of several scenes, every
 * picture one of them took pulled the member off the scene they were on.
 * The picture is drawn from the folder, so it never needed the switch.
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
      stopHear?.();
    };
  }, []);
}
