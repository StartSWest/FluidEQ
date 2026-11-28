/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChatModels } from '../../common/studioChat';

/**
 * What Claude Code answers the Studio's model lookup with, and the catalog
 * it keeps, as recorded on real machines; every account detail is replaced.
 */

/** Claude Code's answer to `initialize`, as 2.1.321 wrote it (trimmed). */
export const ANSWER_2_1_321 = {
  type: 'control_response',
  response: {
    subtype: 'success',
    request_id: 'fluideq-models',
    response: {
      models: [
        {
          value: 'default',
          resolvedModel: 'claude-opus-5-5',
          displayName: 'Default (recommended)',
        },
        {
          value: 'opus',
          resolvedModel: 'claude-opus-5-5',
          displayName: 'Opus 5.5',
          description: 'Best for everyday, complex tasks',
        },
        {
          value: 'fable',
          resolvedModel: 'claude-fable-5-2',
          displayName: 'Fable 5.2',
        },
        {
          value: 'sonnet',
          resolvedModel: 'claude-sonnet-5-5',
          displayName: 'Sonnet 5.5',
        },
        {
          value: 'haiku',
          resolvedModel: 'claude-haiku-5-5',
          displayName: 'Haiku 5.5',
        },
        {
          value: 'claude-haiku-4-5-20251001',
          resolvedModel: 'claude-haiku-4-5-20251001',
          displayName: 'Haiku 4.5',
        },
      ],
    },
  },
};

/** The list read from `ANSWER_2_1_321`. */
export const LIST_2_1_321: IStudioChatModels = {
  checked: true,
  lines: [
    {
      id: 'opus',
      name: 'Opus 5.5',
      description: 'Best for everyday, complex tasks',
    },
    { id: 'fable', name: 'Fable 5.2' },
    { id: 'sonnet', name: 'Sonnet 5.5' },
    { id: 'haiku', name: 'Haiku 5.5' },
  ],
  others: [{ id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' }],
  defaultName: 'Opus 5.5',
};

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Claude Code 2.1.332's answer on a Max account, 2026-11-27, as it came
 * (its `models`, its version, and its account without the email and the
 * organization's name), the night Ivan found no version in the picker and
 * Fable in it twice: the list compiled into Claude Code, its served catalog
 * off for the run. Each line by its family's name alone, the version at the
 * head of its words, Fable only as `claude-fable-5-2[1m]`, nothing older.
 */
export const ANSWER_2_1_332 = {
  type: 'control_response',
  response: {
    subtype: 'success',
    request_id: 'fluideq-models',
    response: {
      models: [
        {
          value: 'default',
          resolvedModel: 'claude-opus-5-5',
          displayName: 'Default (recommended)',
          description: 'Opus 5.5 · Best for everyday, complex tasks',
          supportsEffort: true,
          supportedEffortLevels: EFFORTS,
          supportsAdaptiveThinking: true,
          supportsFastMode: true,
          supportsAutoMode: true,
          supportsThinkingOff: false,
        },
        {
          value: 'opus',
          resolvedModel: 'claude-opus-5-5',
          displayName: 'Opus',
          description: 'Opus 5.5 · Best for everyday, complex tasks',
          supportsEffort: true,
          supportedEffortLevels: EFFORTS,
          supportsAdaptiveThinking: true,
          supportsFastMode: true,
          supportsAutoMode: true,
          supportsThinkingOff: false,
        },
        {
          value: 'claude-fable-5-2[1m]',
          resolvedModel: 'claude-fable-5-2',
          displayName: 'Fable',
          description:
            'Fable 5.2 · Most capable for your hardest and longest-running tasks',
          supportsEffort: true,
          supportedEffortLevels: EFFORTS,
          supportsAdaptiveThinking: true,
          supportsFastMode: true,
          supportsAutoMode: true,
          supportsThinkingOff: false,
        },
        {
          value: 'sonnet',
          resolvedModel: 'claude-sonnet-5-5',
          displayName: 'Sonnet',
          description: 'Sonnet 5.5 · Efficient for routine tasks',
          supportsEffort: true,
          supportedEffortLevels: EFFORTS,
          supportsAdaptiveThinking: true,
          supportsAutoMode: true,
          supportsThinkingOff: false,
        },
        {
          value: 'haiku',
          resolvedModel: 'claude-haiku-5-5',
          displayName: 'Haiku',
          description: 'Haiku 5.5 · Fastest for quick answers',
          supportsEffort: true,
          supportedEffortLevels: EFFORTS,
          supportsAdaptiveThinking: true,
          supportsAutoMode: true,
          supportsThinkingOff: false,
        },
      ],
      account: {
        email: 'member@example.com',
        subscriptionType: 'Claude Max',
        apiProvider: 'firstParty',
      },
      claude_code_version: '2.1.332',
    },
  },
};

/** The list read from `ANSWER_2_1_332`: every line once, with its version. */
export const LIST_2_1_332: IStudioChatModels = {
  checked: true,
  lines: [
    {
      id: 'opus',
      name: 'Opus 5.5',
      description: 'Best for everyday, complex tasks',
    },
    {
      id: 'fable',
      name: 'Fable 5.2',
      description: 'Most capable for your hardest and longest-running tasks',
    },
    {
      id: 'sonnet',
      name: 'Sonnet 5.5',
      description: 'Efficient for routine tasks',
    },
    {
      id: 'haiku',
      name: 'Haiku 5.5',
      description: 'Fastest for quick answers',
    },
  ],
  standIns: [{ id: 'claude-fable-5-2[1m]', line: 'fable' }],
  defaultName: 'Opus 5.5',
  account: { email: 'member@example.com', plan: 'Max' },
};

/** One entry of Claude Code's answer, by the four fields the list reads. */
const entry = (
  value: string,
  displayName: string,
  description: string,
  resolvedModel = value,
) => ({ value, resolvedModel, displayName, description });

const OPUS_WORDS = 'Best for everyday, complex tasks';
const FABLE_WORDS = 'Most capable for your hardest and longest-running tasks';

/**
 * The same Claude Code 2.1.332, half an hour later on the same machine
 * (2026-11-27 23:56, trimmed to the fields the list reads): its catalog
 * for this kind of run had been fetched again, and it answered from it.
 * Each line named with its version, Fable by its exact model only, and the
 * nine older versions beside them in the catalog's order.
 */
export const ANSWER_2_1_332_SERVED = {
  type: 'control_response',
  response: {
    subtype: 'success',
    request_id: 'fluideq-models',
    response: {
      models: [
        entry('default', 'Default (recommended)', `Opus 5.5 · ${OPUS_WORDS}`),
        entry(
          'opus',
          'Opus 5.5',
          'For complex work and everyday tasks',
          'claude-opus-5-5',
        ),
        entry('claude-fable-5-2', 'Fable 5.2', 'For your toughest challenges'),
        entry(
          'sonnet',
          'Sonnet 5.5',
          'Most efficient for simpler tasks',
          'claude-sonnet-5-5',
        ),
        entry(
          'haiku',
          'Haiku 5.5',
          'Fastest for quick answers',
          'claude-haiku-5-5',
        ),
        entry('claude-fable-5-1', 'Fable 5.1', FABLE_WORDS),
        entry(
          'claude-haiku-4-5-20251001',
          'Haiku 4.5',
          'Fastest for quick answers',
        ),
        entry('claude-sonnet-5', 'Sonnet 5', 'Efficient for routine tasks'),
        entry('claude-opus-5', 'Opus 5', OPUS_WORDS),
        entry('claude-fable-5', 'Fable 5', FABLE_WORDS),
        entry('claude-opus-4-8', 'Opus 4.8', OPUS_WORDS),
        entry('claude-opus-4-7', 'Opus 4.7', OPUS_WORDS),
        entry('claude-opus-4-6', 'Opus 4.6', OPUS_WORDS),
        entry('claude-sonnet-4-6', 'Sonnet 4.6', 'Efficient for routine tasks'),
      ],
      claude_code_version: '2.1.332',
    },
  },
};

/** A made-up organization: the catalog's files are named by its id. */
export const ORGANIZATION = '00000000-0000-4000-8000-0000000000aa';

/**
 * The rows of the catalog Claude Code's desktop sessions kept on
 * 2026-11-27 (`cache/model-catalog/<organization>-<key>-ccd.json`, version
 * 2), each as it was but for the fields this does not read: the four lines
 * in `main`, and the nine older versions its "More models" lists.
 */
export const CATALOG_ROWS = [
  {
    id: 'claude-opus-5-5',
    name: 'Opus 5.5',
    section: 'main',
    min_claude_code_version: '2.1.280',
  },
  {
    id: 'claude-fable-5-2',
    name: 'Fable 5.2',
    section: 'main',
    min_claude_code_version: '2.1.290',
  },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', section: 'main' },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', section: 'main' },
  {
    id: 'claude-fable-5-1',
    name: 'Fable 5.1',
    section: 'overflow',
    min_claude_code_version: '2.1.251',
  },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', section: 'overflow' },
  { id: 'claude-sonnet-5', name: 'Sonnet 5', section: 'overflow' },
  { id: 'claude-opus-5', name: 'Opus 5', section: 'overflow' },
  { id: 'claude-fable-5', name: 'Fable 5', section: 'overflow' },
  { id: 'claude-opus-4-8', name: 'Opus 4.8', section: 'overflow' },
  { id: 'claude-opus-4-7', name: 'Opus 4.7', section: 'overflow' },
  { id: 'claude-opus-4-6', name: 'Opus 4.6', section: 'overflow' },
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', section: 'overflow' },
];

/** A catalog file's text, as Claude Code writes one. */
export const catalogFile = (
  rows: Record<string, unknown>[],
  fetchedAt = 1795840589654,
) =>
  JSON.stringify({
    version: 2,
    fetchedAt,
    staleAt: fetchedAt + 3_600_000,
    catalog: {
      surface: 'ccd',
      config: { id: 'ccd', models: rows },
      state: { id: 'ccd', model: 'claude-fable-5-2' },
    },
  });
