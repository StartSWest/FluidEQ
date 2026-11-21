/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { ipcMain } from 'electron';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  FETCH_SHARED_PRESET,
  SHARE_PRESET_LINK,
  isSharedPresetId,
  type TSharePresetLinkOutcome,
  type TSharedPresetFetchOutcome,
} from '../../common/presetShare/sharedPresetLink';
import { cleanUserPresetName } from '../../common/userPresetsFile';
import type { IAccountSession } from '../account/session';
import {
  fetchSharedPreset,
  isShareCode,
  sharePresetLink,
} from '../sharedPresets';

/**
 * Short preset links over IPC (`main/sharedPresets.ts`): making one for a
 * preset of the listener's, and fetching the preset a link names.
 *
 * Nothing the window sends is trusted further than its shape: a name is
 * cleaned as a preset name, a code must be shaped like one, an id must be
 * exactly an id, and the server checks them all again. The token never
 * leaves main.
 */

export interface ISharedPresetLinksDeps {
  config: IAccountConfig;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  logger?: { warn(message: string): void };
  fetchImpl?: typeof fetch;
}

const CHANNELS = [SHARE_PRESET_LINK, FETCH_SHARED_PRESET] as const;

const registerSharedPresetLinksIpc = ({
  config,
  session,
  logger,
  fetchImpl = fetch,
}: ISharedPresetLinksDeps): { dispose(): void } => {
  const token = async (): Promise<string | undefined> => {
    if (!session.state().identity) {
      return undefined;
    }
    try {
      return await session.accessToken();
    } catch {
      return undefined;
    }
  };

  ipcMain.handle(
    SHARE_PRESET_LINK,
    async (
      _event,
      name: unknown,
      code: unknown,
    ): Promise<TSharePresetLinkOutcome> => {
      const clean = typeof name === 'string' ? cleanUserPresetName(name) : '';
      if (clean === '' || !isShareCode(code)) {
        return { ok: false, reason: 'invalid' };
      }
      const accessToken = await token();
      if (!accessToken) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await sharePresetLink({
        config,
        accessToken,
        name: clean,
        code,
        fetchImpl,
      });
      if (!outcome.ok && outcome.reason !== 'signed-out') {
        logger?.warn(`A preset's short link was refused: ${outcome.reason}`);
      }
      return outcome;
    },
  );

  ipcMain.handle(
    FETCH_SHARED_PRESET,
    async (_event, id: unknown): Promise<TSharedPresetFetchOutcome> =>
      isSharedPresetId(id)
        ? fetchSharedPreset({ config, id, fetchImpl })
        : { ok: false, problem: 'missing' },
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

export default registerSharedPresetLinksIpc;
