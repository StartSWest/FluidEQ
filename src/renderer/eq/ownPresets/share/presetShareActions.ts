/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { encodePresetShareCode } from '../../../../common/presetShare/presetShareCode';
import type {
  TSharePresetLinkOutcome,
  TSharePresetLinkRefusal,
} from '../../../../common/presetShare/sharedPresetLink';
import type { Translate } from '../../../../common/i18n';
import { requestAccountPanel } from '../../../account/accountPanel';
import type { IDspCatalogEntry } from '../../../dsp/dspPresetCatalog';
import { startPresetTopic } from '../../../forum/presetTopic';

const codeOf = (preset: IDspCatalogEntry): Promise<string> =>
  encodePresetShareCode(preset.name, preset.settings, preset.curve);

/**
 * A short link for one of the listener's presets (`https://fluideq.com/p/<id>`),
 * made by the server with the account's token (`main/ipc/sharedPresetLinks.ts`).
 * The same preset asked again answers the same link.
 */
export const makePresetShortLink = async (
  preset: IDspCatalogEntry,
  code?: string,
): Promise<TSharePresetLinkOutcome> => {
  const bridge = window.electron?.ipcRenderer;
  if (!bridge?.sharePresetLink) {
    return { ok: false, reason: 'offline' };
  }
  return bridge.sharePresetLink(preset.name, code ?? (await codeOf(preset)));
};

/**
 * What Copy share link's press came to, said where the press was: copied, the
 * server's refusal, or the link made and the clipboard refusing it.
 */
export type TCopyLinkResult = 'copied' | 'not-copied' | TSharePresetLinkRefusal;

/**
 * Copy share link: the short link, on the clipboard. Signed out, the Account
 * panel opens on the sign-in, because a link is kept on FluidEQ's server under
 * somebody's account; nothing is copied. A forum Share made signed out simply
 * goes without a link, and opens no panel.
 */
export const copyPresetLink = async (
  preset: IDspCatalogEntry,
): Promise<TCopyLinkResult> => {
  // Main answers signed-out from the session it holds, before any request.
  const outcome = await makePresetShortLink(preset);
  if (!outcome.ok) {
    if (outcome.reason === 'signed-out') {
      requestAccountPanel('home');
    }
    return outcome.reason;
  }
  try {
    await navigator.clipboard.writeText(outcome.url);
  } catch {
    return 'not-copied';
  }
  return 'copied';
};

/**
 * Share: the Forum, on a new topic in Presets with the preset attached, its
 * name as the title and the post's prompts in the listener's language. With
 * a FluidEQ account the post carries the preset's short link too, so somebody
 * reading it on GitHub without FluidEQ lands on the page that offers it; a
 * link that could not be made leaves the code alone, which is the whole
 * preset either way.
 */
export const sharePresetToForum = async (
  preset: IDspCatalogEntry,
  t: Translate,
): Promise<void> => {
  const code = await codeOf(preset);
  const link = await makePresetShortLink(preset, code);
  startPresetTopic(
    { name: preset.name, code, ...(link.ok ? { link: link.url } : {}) },
    t('presetShare.forum.template'),
  );
};
