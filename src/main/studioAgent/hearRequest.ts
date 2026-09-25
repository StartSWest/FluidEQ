/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STUDIO_AGENT_SONGS,
  type TStudioAgentSong,
} from '../../common/studioAgent';

/**
 * What the Studio's hear_the_music tool may be asked (`studioTools.ts`): which
 * of the two songs FluidEQ keeps, and nothing else. Checked as strictly as a
 * look: a key the schema does not name, or a value it does not list, is
 * refused with the reason.
 */

export const HEAR_SCHEMA = {
  type: 'object',
  properties: {
    song: {
      type: 'string',
      enum: [...STUDIO_AGENT_SONGS],
      description:
        '"now" (the default): the song playing, or the last one heard. "before": the one before it, when the member has moved on to another.',
    },
  },
  additionalProperties: false,
} as const;

export const readHearRequest = (
  args: Record<string, unknown>,
): { song: TStudioAgentSong } | string => {
  const unknownKey = Object.keys(args).find((key) => key !== 'song');
  if (unknownKey !== undefined) {
    return `There is no argument called ${JSON.stringify(unknownKey.slice(0, 40))}.`;
  }
  if (args.song === undefined) {
    return { song: 'now' };
  }
  const song = STUDIO_AGENT_SONGS.find((name) => name === args.song);
  return song ? { song } : 'song must be "now" or "before".';
};
