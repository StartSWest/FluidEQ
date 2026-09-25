/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { versionToPublish } from '../../common/sceneVersionNote';
import { MANIFEST_FILE, readManifest, writeInside } from './projectFiles';
import type { TSettingsWrite } from './projectSettings';
import { queueSettingsWrite } from './settingsWrites';

/**
 * Raising a project's version so a publication goes out above the one the
 * gallery already holds.
 *
 * A scene's content may only change under a higher number
 * (`isLaterSceneVersion`), and publishing is the only moment the number has
 * to move — so this is where it moves, rather than in a field a maker has to
 * remember to edit before every press.
 *
 * It goes through the same queue as a settings save and writes the same file
 * a slider does: a publication pressed straight after a slider would
 * otherwise read the manifest before that save landed and write it back
 * without the value.
 *
 * Only `version` changes. Everything else in the manifest is written back as
 * it was read, as a settings save does — a publication is not a chance to
 * tidy somebody's file.
 */
export const raiseProjectVersion = (
  folder: string,
  /** The version in the gallery now; undefined for a first publication. */
  held: number | undefined,
): Promise<TSettingsWrite> =>
  queueSettingsWrite(folder, async () => {
    let manifest: Record<string, unknown>;
    try {
      manifest = await readManifest(folder);
    } catch {
      return 'failed';
    }
    const next = versionToPublish(manifest.version, held);
    if (next === manifest.version) {
      return 'unchanged';
    }
    manifest.version = next;
    try {
      // The same file the read took, checked the same way: directly in the
      // folder, never a link out of it.
      await writeInside(
        folder,
        MANIFEST_FILE,
        'pack.json',
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      return 'written';
    } catch {
      return 'failed';
    }
  });
