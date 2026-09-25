/**
 * What a member pastes into their AI assistant to connect it to the Studio's
 * agent door (`main/studioAgent/studioAgentDoor.ts`): the address and the
 * key, in each assistant's own configuration format.
 *
 * Commands and configuration, never translated: they are typed into a
 * terminal or a settings file, and a translated word there is a broken line.
 * The server is named `fluideq` in all three, so the assistant's tool reads as
 * FluidEQ's wherever it lists it.
 */

export type TAgentAssistant = 'claude' | 'codex' | 'other';

export const AGENT_ASSISTANTS: readonly TAgentAssistant[] = [
  'claude',
  'codex',
  'other',
];

/** The setup, whole: what the Copy button puts on the clipboard. */
export const agentSetup = (
  assistant: TAgentAssistant,
  url: string,
  key: string,
): string => {
  switch (assistant) {
    case 'claude':
      return `claude mcp add --transport http --scope user fluideq ${url} --header "Authorization: Bearer ${key}"`;
    case 'codex':
      return `[mcp_servers.fluideq]
url = "${url}"
http_headers = { "Authorization" = "Bearer ${key}" }`;
    case 'other':
    default:
      return `{
  "mcpServers": {
    "fluideq": {
      "type": "http",
      "url": "${url}",
      "headers": { "Authorization": "Bearer ${key}" }
    }
  }
}`;
  }
};

/**
 * How much of the key the Studio shows. Enough to tell two keys apart after
 * a new one is made, and nothing a screenshot of the Studio could be used
 * with: the whole key only ever goes to the clipboard.
 */
const KEY_SHOWN = 4;

/** The key as the Studio shows it anywhere: its first letters. */
export const shownKey = (key: string) => `${key.slice(0, KEY_SHOWN)}…`;

/** The setup as the card shows it, with the key cut down to its first letters. */
export const shownAgentSetup = (
  assistant: TAgentAssistant,
  url: string,
  key: string,
): string => agentSetup(assistant, url, shownKey(key));
