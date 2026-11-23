/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Shared contract between the Tuning Agent Door (`main/tuningAgent/`) and the
 * window's controls (`TuningAgentDialog`).
 *
 * Separate from `common/studioAgent.ts` on purpose: Studio's door is read-only
 * visual rendering, whereas the Tuning door mutates live audio that reaches
 * the listener's ears. The two carry different ports, keys, switches, and
 * safety controls.
 */

export const TUNING_AGENT_CHANNELS = {
  getDoor: 'tuning-agent-door',
  setDoor: 'tuning-agent-door-set',
  newKey: 'tuning-agent-new-key',
  revert: 'tuning-agent-revert',
  abToggle: 'tuning-agent-ab',
  changed: 'tuning-agent-changed',
  micSoundChanged: 'mic-sound-changed',
} as const;

export type TTuningAbMode = 'original' | 'tuned';

export interface ITuningSessionSummary {
  /** Whether a pre-AI snapshot is stored and can be reverted or A/B compared. */
  hasSnapshot: boolean;
  /** Which sound is currently playing when a snapshot exists. */
  mode: TTuningAbMode;
  /** Number of AI write calls applied since the session snapshot was taken. */
  changeCount: number;
  /** Name of the most recent AI tool that modified audio. */
  lastTool?: string;
  /** ISO timestamp of the most recent AI audio change. */
  lastChangedAt?: string;
}

export type ITuningAgentDoor =
  | {
      open: false;
      failed?: boolean;
      session: ITuningSessionSummary;
    }
  | {
      open: true;
      url: string;
      key: string;
      session: ITuningSessionSummary;
    };

export const EMPTY_TUNING_SESSION: ITuningSessionSummary = {
  hasSnapshot: false,
  mode: 'tuned',
  changeCount: 0,
};

export type TTuningAssistant = 'claude' | 'codex' | 'other' | 'cli';

export const TUNING_ASSISTANTS: readonly TTuningAssistant[] = [
  'claude',
  'codex',
  'other',
  'cli',
];

const SERVER_NAME = 'fluideq-tuning';

/**
 * Configuration snippet for connecting an external AI assistant or the thin
 * companion CLI to the local Tuning MCP Door. Never translated: every line is
 * pasted into a terminal or JSON/TOML config file.
 */
export const tuningAgentSetup = (
  assistant: TTuningAssistant,
  url: string,
  key: string,
): string => {
  switch (assistant) {
    case 'claude':
      return `claude mcp add --transport http --scope user ${SERVER_NAME} ${url} --header "Authorization: Bearer ${key}"`;
    case 'codex':
      return `[mcp_servers.${SERVER_NAME}]
url = "${url}"
http_headers = { "Authorization" = "Bearer ${key}" }`;
    case 'cli':
      return `pnpm tune -- status\n# Or explicitly:\npnpm tune -- --url "${url}" --key "${key}" measure`;
    case 'other':
    default:
      return `{
  "mcpServers": {
    "${SERVER_NAME}": {
      "type": "http",
      "url": "${url}",
      "headers": { "Authorization": "Bearer ${key}" }
    }
  }
}`;
  }
};

const KEY_SHOWN = 4;

/** Masked key for on-screen display so screenshots cannot leak credentials. */
export const shownTuningKey = (key: string): string =>
  `${key.slice(0, KEY_SHOWN)}…`;

export const shownTuningAgentSetup = (
  assistant: TTuningAssistant,
  url: string,
  key: string,
): string => tuningAgentSetup(assistant, url, shownTuningKey(key));
