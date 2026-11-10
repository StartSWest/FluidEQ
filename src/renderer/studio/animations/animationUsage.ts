/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { IViewedAnimation } from './useStudioAnimations';

export type TAnimationUsage = 'used' | 'unused' | 'unknown';

interface IArtworkFacts {
  /** Region id -> the `art/<name>.png` it was packed from (main's record). */
  sources: Record<string, string>;
  /** Every region of the scene's artwork now; none when it has no artwork. */
  regions: string[];
}

/**
 * Whether the scene plays an animation (Ivan, 2026-11-10): the scene plays
 * only what is packed into its artwork, and main records which picture each
 * piece was packed from (`artworkSources.ts`). Used when a piece came from
 * the animation's sheet; unused only when every piece of the artwork is
 * accounted for and none did - a scene with no artwork plays none. Anything
 * else is unknown, and unknown is never unused: an artwork packed before the
 * record has pieces with no source, and its animations ask the chat.
 */
export const usageOf = (
  sheet: string,
  facts: IArtworkFacts | undefined,
): TAnimationUsage => {
  if (!facts) {
    return 'unknown';
  }
  const { sources, regions } = facts;
  if (Object.values(sources).includes(sheet)) {
    return 'used';
  }
  // The record names regions in lower case; an artwork may not.
  const known = (id: string) =>
    sources[id] !== undefined || sources[id.toLowerCase()] !== undefined;
  return regions.every(known) ? 'unused' : 'unknown';
};

const bridge = () => window.electron?.ipcRenderer;

/** The record and the artwork's regions as main has them now. */
const readFacts = async (): Promise<IArtworkFacts | undefined> => {
  const api = bridge();
  const [record, pictures] = await Promise.all([
    api?.readStudioArtworkSources?.(),
    api?.readStudioPictures?.(),
  ]);
  if (!record?.ok || !pictures || pictures.kind === 'impossible') {
    return undefined;
  }
  return {
    sources: record.sources,
    regions:
      pictures.kind === 'atlas'
        ? (pictures.regions ?? []).map(({ id }) => id)
        : [],
  };
};

/**
 * Each animation's use, read again whenever the tab reads the animations
 * (the record lives beside the history, where the animations' watcher does
 * not look), and `fresh` asks main at the moment it matters - Delete.
 */
export default function useAnimationUsage(animations: IViewedAnimation[]) {
  const [facts, setFacts] = useState<IArtworkFacts>();
  useEffect(() => {
    // Asked only where main can answer; elsewhere the answer stays unknown.
    if (!bridge()?.readStudioArtworkSources) {
      return undefined;
    }
    let live = true;
    readFacts()
      .then((read) => {
        if (live) {
          setFacts(read);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [animations]);
  const usage = useCallback(
    (viewed: IViewedAnimation) => usageOf(viewed.animation.sheet, facts),
    [facts],
  );
  const fresh = useCallback(async (viewed: IViewedAnimation) => {
    const read = await readFacts();
    setFacts(read);
    return usageOf(viewed.animation.sheet, read);
  }, []);
  return { usage, fresh };
}
