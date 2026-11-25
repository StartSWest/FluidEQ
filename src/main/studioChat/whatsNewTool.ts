/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_VERSION_NOTE,
  VERSION_NOTE_LOCALES,
} from '../../common/sceneVersionNote';
import {
  readLooseNoteLines,
  STUDIO_NOTES_CONTRACT,
  STUDIO_NOTES_FILE,
} from '../../common/studioNotes';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import { writeNoteLines } from '../ipc/studioNotes';
import { failure, text } from './artFolder';

/**
 * The publish line written by the chat in the one shape the Publish dialog
 * reads, instead of by hand (Ivan, 2026-11-13: "the agent is lost, doesn't
 * know where notes I am talking about"). Asked for "release notes" on a
 * scene never published, the chat wrote a line, then a header and a
 * description, then a plain English line it called "still a guess"; the box
 * stayed empty and Send held through all three. Here the line is read by
 * the same reader the dialog uses, written into the project's notes with
 * nothing else in the file touched, and the answer says what the box shows
 * now - or exactly why nothing could be kept.
 */

interface IWhatsNewToolDeps {
  /** The chat's project, confirmed again on every call. */
  project: () => TAgentProject;
}

const SCHEMA = {
  type: 'object',
  properties: {
    whatsNew: {
      description: `The line in every language: an object with ${VERSION_NOTE_LOCALES.join(', ')} ("en" required), each one line of at most ${MAX_VERSION_NOTE} characters saying the same thing as a listener would put it. A first version says what the scene is; an update says what changed since the Gallery's version.`,
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  },
  required: ['whatsNew'],
  additionalProperties: false,
};

const createWhatsNewTool = ({ project }: IWhatsNewToolDeps): IMcpTool => {
  const call = async (
    args: Record<string, unknown>,
  ): Promise<IMcpToolResult> => {
    const open = project();
    if (!open.ok) {
      return failure("The chat's project is not open in the Studio now.");
    }
    const { lines, unreadable } = readLooseNoteLines(args.whatsNew);
    if (!lines) {
      return failure(
        unreadable
          ? `Nothing in that line can be kept: give "en" a line of at most ${MAX_VERSION_NOTE} characters, on one line, and the other languages beside it.`
          : 'Give the line: whatsNew, an object with at least "en".',
      );
    }
    const written = writeNoteLines(open.folder, lines);
    if (!written.ok) {
      // The reason and the one way on (Alpine, 2026-11-25): told only that
      // the notes "could not be written", the chat wrote the file by hand,
      // which skips this reader and costs the member's description whole
      // the moment a quote in a translation breaks the JSON.
      return failure(
        `The notes could not be written in the project folder (${written.reason}): another program may be holding ${STUDIO_NOTES_FILE}. Call write_whats_new once more. If it fails again, do not write ${STUDIO_NOTES_FILE} yourself - give the member the English line and say it could not be saved, so they can paste it into the Publish dialog.`,
      );
    }
    const missing = VERSION_NOTE_LOCALES.filter((locale) => !lines[locale]);
    return {
      content: [
        text(
          `Saved. The Publish dialog's "What's new" box shows: ${JSON.stringify(lines.en)}${
            missing.length > 0
              ? ` - still to write in ${missing.join(', ')}: call this again with every language.`
              : // The member is waiting on the dialog, not on more work.
                '. That is every language: nothing else is needed. Answer with the English line alone, with no further checks or tools.'
          }`,
        ),
      ],
    };
  };

  return {
    name: 'write_whats_new',
    title: 'Write the publish line',
    description: `Sets the line FluidEQ's Publish dialog shows in its "What's new" box, for a first version or an update, and keeps everything else in the project's notes as it is. ${STUDIO_NOTES_CONTRACT}`,
    inputSchema: SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false },
    call,
  };
};

export default createWhatsNewTool;
