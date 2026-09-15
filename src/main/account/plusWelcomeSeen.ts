/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { createAccountVersions } from './accountVersions';

/**
 * Which accounts on this computer have already been welcomed to Plus.
 *
 * Per account, like the terms notice beside it: the welcome belongs to the
 * person who paid, so somebody else signing in here has not been welcomed and
 * must be. One number rather than a flag, because the store only ever raises
 * one — a welcome that is reworded later can be given again by raising this,
 * and putting an old one away can never bring it back.
 */

const SEEN_FILE = 'plus-welcome.json';

/** Raise to welcome every member again after a rewrite worth showing. */
export const PLUS_WELCOME_EDITION = 1;

const seenIn = (userDataDir: string) =>
  createAccountVersions(path.join(userDataDir, SEEN_FILE));

export const readPlusWelcomeSeen = (
  userDataDir: string,
  accountId: string,
): number => seenIn(userDataDir).read(accountId);

export const writePlusWelcomeSeen = (
  userDataDir: string,
  accountId: string,
  edition: number,
) => seenIn(userDataDir).write(accountId, edition);
