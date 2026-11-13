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

const createWhatsNewTool = ({
  project,
}: IWhatsNewToolDeps): IMcpTool => {
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
    if (!writeNoteLines(open.folder, lines)) {
      return failure('The notes could not be written in the project folder.');
    }
    const missing = VERSION_NOTE_LOCALES.filter((locale) => !lines[locale]);
    return {
      content: [
        text(
          `Saved. The Publish dialog's "What's new" box shows: ${JSON.stringify(lines.en)}${
            missing.length > 0
              ? ` - still to write in ${missing.join(', ')}: call this again with every language.`
              : '.'
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
