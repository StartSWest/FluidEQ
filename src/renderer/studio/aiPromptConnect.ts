import { agentSetup } from './studioAgentSetup';

/**
 * The part of the Studio's AI prompt that connects the member's AI to the
 * Studio's agent door by itself (`main/studioAgent/studioAgentDoor.ts`).
 *
 * Ivan, 2026-09-24: "I don't want users to run commands manually, they just
 * copy the prompt once and that's it." So the prompt carries the door's
 * address and key, and tells the AI to register the server itself — the same
 * setup the card shows for doing it by hand (`studioAgentSetup.ts`) — and, for
 * the session it is in, to call the tool straight over HTTP: an assistant
 * loads a server it was just given only when it next starts, and waiting for
 * that is the member restarting it, which is a step.
 *
 * It holds the key, so it is only ever added to the text that goes to the
 * clipboard (and with the key cut short wherever the Studio shows it), and
 * never to the notes saved in the project's folder: a folder is synced,
 * shared and published. The door answers this computer alone, so the key is
 * worth nothing to anybody who reads the prompt anywhere else.
 *
 * English, like the rest of the prompt: it is read by a model.
 */

export interface IPromptConnection {
  url: string;
  key: string;
}

const indent = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line) => `${' '.repeat(spaces)}${line}`)
    .join('\n');

export const connectSection = (
  { url, key }: IPromptConnection,
  folder?: string,
): string => {
  const call = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'look_at_scene',
      arguments: folder ? { folder } : {},
    },
  });
  return `CONNECT TO FLUIDEQ FIRST
FluidEQ's Studio can show you what you make and let you hear the song it is
for: it is an MCP server on this computer with two tools, look_at_scene (LOOK
AT WHAT YOU MADE, below, says how to use it) and hear_the_music (HEAR THE
SONG, below). Connecting to it is your job, not mine: do it now, once, before
anything else, without asking me.
- If you are Claude Code, run:
${indent(agentSetup('claude', url, key), 4)}
- If you are Codex, add these lines at the end of config.toml in the .codex
  folder of my user folder, making the file if it is not there:
${indent(agentSetup('codex', url, key), 4)}
- Any other assistant: add this server to your MCP settings:
${indent(agentSetup('other', url, key), 4)}
A server named fluideq that is already there is an older one: replace it, as
the key changes whenever I make a new one.
A server added now usually reaches you only when you next start, so until
its tools are among yours, call them straight over HTTP - they are the same
tools. POST to ${url} with the headers
    Authorization: Bearer ${key}
    Content-Type: application/json
and the body
    ${call}
with the arguments you want added inside "arguments", or "hear_the_music"
for the name to hear the song. The answer's result.content holds FluidEQ's
text, and for a look the picture, a base64 JPEG: write the picture to a file
in your temporary folder - never into this project - and open that file to
look at it. A 401 means I made a new key: ask me to copy the prompt again.
Nothing answering at all means FluidEQ is closed: ask me to open it.
The key is yours alone to use: never write it into this project, its notes,
or anything I might share.

`;
};
