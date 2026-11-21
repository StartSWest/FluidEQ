/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IDspSettings, IEqSettings } from '../../../../common/dsp/chain';
import type { Translate } from '../../../../common/i18n';
import { dspPresetStages } from '../../../dsp/dspPresetCatalog';

/** How a shared preset is written for a forum that is not FluidEQ's. */
export type TShareFormat = 'markdown' | 'bbcode' | 'plain';

/**
 * One Discord message without Nitro. The export counts against it because
 * Discord is where a preset is most often pasted, and past it Discord turns
 * the message into a file nobody opens.
 */
export const DISCORD_MESSAGE_MAX = 2000;

export interface ISharedPresetText {
  name: string;
  settings: IDspSettings;
  curve?: IEqSettings;
  code: string;
}

/** The rack's stages, without the EQ: the curve has a line of its own. */
export const rackStageNames = (
  settings: IDspSettings,
  t: Translate,
): string[] => {
  const eq = t('dsp.eq.title');
  return dspPresetStages({ settings }, t).filter((name) => name !== eq);
};

/** "Curve: 4 bands · Rack: Bass Punch, Maximizer", whichever it has. */
export const presetSummaryLine = (
  { settings, curve }: Pick<ISharedPresetText, 'settings' | 'curve'>,
  t: Translate,
): string => {
  const stages = rackStageNames(settings, t);
  const bands = curve?.bands.filter((band) => band.enabled !== false).length;
  return [
    bands ? t('presetShare.text.curve', { count: bands }) : '',
    stages.length > 0
      ? t('presetShare.text.rack', { stages: stages.join(', ') })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

/**
 * The text that pastes into a forum: the preset's name, what it holds, and
 * the link that opens it in FluidEQ. The link carries the whole preset, so
 * the code as text is only for the boards that shorten or strip links.
 *
 * The name is written as the listener typed it. It is plain text in every
 * format but Markdown and BBCode's markup characters are left alone: a
 * forum shows them as typed at worst, and nothing here is ever read back
 * from this text but the code (`readPresetShareCode`).
 */
export const presetShareText = (
  preset: ISharedPresetText,
  format: TShareFormat,
  // Read again when the short link returns; the code always travels now.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above
  _withCode: boolean,
  t: Translate,
): string => {
  // No link until short links (fluideq.com/p/<id>) are on the server and the
  // site: a link that opens nothing is worse than none (Ivan, 2026-11-20:
  // "copy shared link?? really? that doesn't work"). The code is what any
  // FluidEQ reads back, so it always travels; `withCode` waits for the link.
  const title = t('presetShare.text.title', { name: preset.name });
  const summary = presetSummaryLine(preset, t);
  const hint = t('presetShare.export.pasteHint');
  const lines: string[] = [];
  if (format === 'markdown') {
    lines.push(`**${title}**`);
    if (summary) {
      lines.push(summary);
    }
    lines.push('```fluideq-preset', preset.code, '```', hint);
  } else if (format === 'bbcode') {
    lines.push(`[b]${title}[/b]`);
    if (summary) {
      lines.push(summary);
    }
    lines.push(`[code]${preset.code}[/code]`, hint);
  } else {
    lines.push(title);
    if (summary) {
      lines.push(summary);
    }
    lines.push(preset.code, hint);
  }
  return lines.join('\n');
};
