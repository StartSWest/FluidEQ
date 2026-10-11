/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStudioChatEntry } from '../../common/studioChat';
import type { createTranscripts, IChatTranscript } from './chatTranscript';

/**
 * Each project's chat, read from disk once and kept while FluidEQ runs, and
 * written back as it changes.
 */
const createTranscriptCache = (
  transcripts: ReturnType<typeof createTranscripts>,
  logger?: { warn(message: string): void },
) => {
  const loaded = new Map<string, IChatTranscript>();

  const transcriptOf = (projectId: string) => {
    const known = loaded.get(projectId);
    if (known) {
      return known;
    }
    const read = transcripts.read(projectId);
    loaded.set(projectId, read);
    return read;
  };

  const save = (projectId: string) => {
    try {
      transcripts.write(projectId, transcriptOf(projectId));
    } catch (error) {
      logger?.warn(`The Studio's chat could not be saved: ${String(error)}`);
    }
  };

  /**
   * The chat with the reply being written in it, as far as it has got: so
   * FluidEQ closing, a crash or a power cut mid-reply leaves what Claude had
   * said and done on disk, where it reads back as stopped and can be carried
   * on (Ivan, 2026-10-09: "the chat needs to recover if the app closes").
   * Written at each step and paragraph rather than each word, which would
   * be a file a few hundred times a reply.
   */
  const saveWith = (
    projectId: string,
    reply: Extract<TStudioChatEntry, { kind: 'claude' }>,
  ) => {
    const transcript = transcriptOf(projectId);
    try {
      transcripts.write(projectId, {
        ...transcript,
        entries: [...transcript.entries, reply],
      });
    } catch (error) {
      logger?.warn(`The Studio's chat could not be saved: ${String(error)}`);
    }
  };

  return {
    transcriptOf,
    save,
    saveWith,
    /** Read again from disk next time: a new chat was begun. */
    unload: (projectId: string) => {
      loaded.delete(projectId);
    },
  };
};

export default createTranscriptCache;
