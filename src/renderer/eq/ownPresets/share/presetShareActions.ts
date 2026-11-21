/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  encodePresetShareCode,
  presetShareLink,
} from '../../../../common/presetShare/presetShareCode';
import type { Translate } from '../../../../common/i18n';
import type { IDspCatalogEntry } from '../../../dsp/dspPresetCatalog';
import { startPresetTopic } from '../../../forum/presetTopic';

const codeOf = (preset: IDspCatalogEntry): Promise<string> =>
  encodePresetShareCode(preset.name, preset.settings, preset.curve);

/** A preset's share link, on the clipboard: the one line any forum takes. */
export const copyPresetLink = async (
  preset: IDspCatalogEntry,
): Promise<void> => {
  await navigator.clipboard.writeText(presetShareLink(await codeOf(preset)));
};

/**
 * Share: the Forum, on a new topic in Presets with the preset attached, its
 * name as the title and the post's prompts in the listener's language.
 */
export const sharePresetToForum = async (
  preset: IDspCatalogEntry,
  t: Translate,
): Promise<void> => {
  startPresetTopic(
    { name: preset.name, code: await codeOf(preset) },
    t('presetShare.forum.template'),
  );
};
