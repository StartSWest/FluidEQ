/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  IAudioDevice,
  ICustomFxSettings,
  IState,
  TApoFeature,
  TApoLayer,
} from '../common/constants';
import { adoptBlock, hasChainDrifted } from '../common/apoSync';
import { parseEqText } from '../common/apoText';
import { parseCustomFx } from '../common/customFx';
import { hasSmartEqLayer, smartEqFromFilters } from '../common/smartEq';
import { save, stateToApoFiles, stateToString } from './flush';
import { getCustomFileNameForDevice } from './deviceProfiles';
import { readApoDeviceChain } from './apoConfigReader';

/**
 * Reading Equalizer APO's own config back, and believing it when it disagrees.
 *
 * Two hundred and eighty lines of main.ts, and the only part of it that treats
 * the config file as an input rather than an output. Somebody can edit
 * fluideq.txt by hand, or another tool can, and the alternative to reading it
 * back is an app whose UI quietly disagrees with what is actually being played.
 *
 * The comparison is by audible shape rather than by text. FluidEQ's own writes
 * therefore compare equal and stop, while an external edit is adopted once,
 * persisted, and canonicalised — and the canonical rewrite compares equal on
 * the next event, so adoption cannot loop.
 *
 * Takes the live state and mutates it, rather than returning a new one. That is
 * what the rest of main.ts does with this object, and returning a copy here
 * would leave two versions of the truth for the caller to reconcile.
 */
export interface IApoAdoptDeps {
  state: IState;
  session: {
    configPath: string;
    activeAudioDeviceId: string;
    activeAudioDevice: IAudioDevice | undefined;
    hasActiveSessionOverride: boolean;
  };
  userDataDir: string;
  /** Re-reads the convolution file named by a config we just adopted. */
  hydrateActiveConvolution: () => void;
}

export const createApoAdoption = ({
  hydrateActiveConvolution,
  session,
  state,
  userDataDir,
}: IApoAdoptDeps) => {
  let hasAdoptedExistingConfig = false;

  /**
   * What we would write for the bands alone, in the shape the reader returns.
   *
   * The comparison has to be like for like. The reader hands back the device's
   * own lines plus the EQ file, so this is the same slice of what the writer
   * would produce — the convolution, the bands, and the whole-chain preamp that
   * sits in the device file beside them. Comparing the state's own fields instead
   * would report drift on FluidEQ's own output every launch, because the preamp
   * is derived, inert bands are dropped and everything is clamped on the way out.
   */
  const expectedBandChain = (devicePattern: string) => {
    const files = stateToApoFiles(state, state.convolution?.fileName);
    if (!files) {
      return '';
    }
    return [
      `Device: ${devicePattern}`,
      'Channel: all',
      ...(files.convolution ? [files.convolution] : []),
      ...(files.features.find(({ feature }) => feature === 'eq')?.lines ?? []),
      files.preAmp,
    ].join('\n');
  };

  /**
   * Believe the config about which layers are switched off.
   *
   * A bypassed layer is one whose settings are all still there and whose
   * `Include:` is simply not written, so the config states it as plainly as it
   * states anything else: this is a feature that would be written, and it is not
   * in the file. That is what lets an A/B comparison survive a restart, which the
   * old session-only stash could not — it had to be session-only precisely
   * because a stash and a config would have been two places disagreeing about
   * what was applied.
   *
   * Compared against what would be written with nothing bypassed, because the
   * question is which of the layers this profile actually has are missing from
   * the file. A feature with nothing to say is absent from both sides and is not
   * switched off, it is empty.
   */
  const adoptBypassFromConfig = (
    features: Partial<Record<TApoFeature, string>>,
    shared: string,
  ): boolean => {
    const wouldWrite = stateToApoFiles(
      { ...state, bypassed: undefined },
      state.convolution?.fileName,
    );
    if (!wouldWrite) {
      return false;
    }
    const bypassed: TApoLayer[] = wouldWrite.features
      .map(({ feature }) => feature)
      .filter((feature) => features[feature] === undefined);

    // The impulse is read the same way, from the one place it can be: it has no
    // file of its own, so what says it is applied is a Convolution line sitting
    // in the device file among the includes.
    if (wouldWrite.convolution && !/^\s*Convolution\s*:/im.test(shared)) {
      bypassed.push('convolution');
    }

    const next = bypassed.length ? bypassed : undefined;

    if (JSON.stringify(next) === JSON.stringify(state.bypassed)) {
      return false;
    }
    log.info(
      `Adopting the switched-off layers from the Equalizer APO config: ${
        next?.join(', ') || 'none'
      }.`,
    );
    state.bypassed = next;
    save(state, userDataDir);
    return true;
  };

  /**
   * Read the active output's user-owned custom file without modifying it.
   *
   * The custom Include can be bypassed, so reading only the expanded chain would
   * make the layer disappear and remove the very switch that could bring it
   * back. The file name is deterministic from the endpoint id; reading it
   * directly keeps the layer available in both states.
   */
  const readCustomFxForDevice = (
    deviceId: string,
  ): ICustomFxSettings | undefined => {
    if (!session.configPath || !deviceId) {
      return undefined;
    }
    const fileName = getCustomFileNameForDevice(deviceId);
    try {
      const contents = fs.readFileSync(
        path.join(session.configPath, fileName),
        'utf8',
      );
      return parseCustomFx(fileName, contents);
    } catch {
      return undefined;
    }
  };

  const readCustomFxForActiveDevice = (): ICustomFxSettings | undefined =>
    readCustomFxForDevice(session.activeAudioDeviceId);

  /** Refresh the renderer-facing description of the user-owned custom file. */
  const syncCustomFxFromConfig = (): boolean => {
    const next = readCustomFxForActiveDevice();
    if (JSON.stringify(next) === JSON.stringify(state.customFx)) {
      return false;
    }
    state.customFx = next;
    return true;
  };

  const adoptExistingApoConfig = () => {
    if (hasAdoptedExistingConfig || !session.configPath) {
      return;
    }

    // Nothing to read until it is known which output this is about.
    //
    // The health check runs first and used to spend the one attempt here, at the
    // moment the answer was still "no endpoint yet" — which resolved to the
    // neutral `Device: all` block, the one FluidEQ writes precisely to say
    // nothing. So the whole of this ran, found an empty block, and marked itself
    // done. Deferring costs a few hundred milliseconds and is the difference
    // between a config that is read back and one that never is.
    const devicePattern =
      session.activeAudioDevice?.guid || session.activeAudioDevice?.name;
    if (!devicePattern) {
      return;
    }
    hasAdoptedExistingConfig = true;

    try {
      // This is independent of the generated feature files. It must be read
      // before any early return below, including a bypassed custom Include.
      syncCustomFxFromConfig();
      const chain = readApoDeviceChain(session.configPath, devicePattern);
      if (!chain) {
        return;
      }

      // With the features in files of their own, the bands are read on their own:
      // the device's convolution and preamp, plus the EQ file, and none of the
      // layers. Without that attribution the whole block is all there is.
      const { features } = chain;

      // First, and before any of the guards below can return: a bypassed EQ is
      // one with no file at all, so the very case this has to recognise is the
      // one the "no bands, nothing to adopt" check bows out of.
      if (features) {
        adoptBypassFromConfig(features, chain.shared ?? '');
      }

      // The measurement, if the state has lost it and the config still has it.
      //
      // Alone among the layers, Smart EQ can be read back in full: its file is
      // the correction rather than a rendering of settings that produced it. So
      // it is the one place the config-as-truth rule can protect a layer instead
      // of only describing it — whatever it was that made a measurement go
      // missing, it is still in the config and comes back here.
      //
      // Only when there is nothing to lose. A layer already in the state is the
      // newer of the two, and an absent file is not silence: it is how a
      // switched-off layer is written, which the line above has just read.
      if (features?.smart && !hasSmartEqLayer(state.smartEq)) {
        const recovered = smartEqFromFilters(
          Object.values(parseEqText(features.smart).filters),
        );
        if (recovered) {
          log.info(
            'Restoring the Smart EQ correction from the Equalizer APO config.',
          );
          state.smartEq = recovered;
          save(state, userDataDir);
        }
      }

      const adopted = adoptBlock({
        devicePattern: chain.devicePattern,
        text: features
          ? [chain.shared ?? '', features.eq ?? ''].join('\n')
          : chain.text,
      });
      if (!adopted) {
        return;
      }

      // Two things make a block unsafe to adopt, and both were found the hard way
      // by this wiping a live EQ off the screen.
      //
      // 1. A block with a preamp but no filters is not "the user cleared their
      //    bands". It is what FluidEQ writes for a flat EQ, or for one whose only
      //    audible content is a voicing or a convolution. Adopting it emptied the
      //    band editor completely — no sliders at all, which is not a state the
      //    editor is even supposed to be able to reach.
      //
      // 2. In a flat config the voicing, driver and Smart EQ layers are written
      //    into the same numbered `Filter N:` sequence as the user's own bands,
      //    with nothing distinguishing them. If any of them is active, there is
      //    no way to tell which lines came from where, and adopting would pull
      //    the layers into the band editor as ordinary bands — where the next
      //    flush would then write the layers on top of them again. Smart EQ is
      //    the worst case: it is roughly two dozen bands, so adopting past it
      //    would double a whole measured correction rather than one small curve.
      //    This is the refusal the split exists to lift, and it now applies only
      //    where it still has to.
      const hasBands =
        Object.keys(adopted.filters).length > 0 ||
        (adopted.graphicEq?.length ?? 0) > 0;
      const hasIndistinguishableLayers =
        !features &&
        (!!state.voicing?.profileId ||
          !!state.driver?.profileId ||
          hasSmartEqLayer(state.smartEq));

      if (!hasBands || hasIndistinguishableLayers) {
        return;
      }

      const expected = features
        ? expectedBandChain(chain.devicePattern)
        : stateToString(
            state,
            state.convolution?.fileName,
            chain.devicePattern,
          );
      if (!hasChainDrifted(expected, adopted)) {
        // The file says what we would have written. Nothing happened while we
        // were away.
        return;
      }

      log.info(
        `Adopting the Equalizer APO config for ${chain.devicePattern}: it no longer matches the stored state.`,
      );
      state.preAmp = adopted.preAmp;
      state.filters = adopted.filters;
      state.eqFormat = adopted.eqFormat;
      state.graphicEq = adopted.graphicEq;
      // Bands exist, so the chain is not flat whatever the stored flag said.
      state.isFlat = Object.keys(adopted.filters).length === 0;
      // The attribution described bands that are no longer these bands.
      state.headset = undefined;
      state.headsetTarget = undefined;
      state.headsetSource = undefined;
      state.eqImport = undefined;

      if (adopted.convolutionFileName) {
        // The WAV is still next to the config and still what APO is applying, so
        // keep it applied. Its catalogue name is not recoverable from the config,
        // so it is described by the only thing the file actually states.
        state.convolution = {
          name:
            state.convolution?.fileName === adopted.convolutionFileName
              ? state.convolution.name
              : adopted.convolutionFileName,
          filters: state.convolution?.filters ?? {},
          fileName: adopted.convolutionFileName,
          response:
            state.convolution?.fileName === adopted.convolutionFileName
              ? state.convolution.response
              : undefined,
          peakGainDb:
            state.convolution?.fileName === adopted.convolutionFileName
              ? state.convolution.peakGainDb
              : undefined,
          sourceId: state.convolution?.sourceId,
          sourceUrl: state.convolution?.sourceUrl,
        };
      } else {
        state.convolution = undefined;
      }

      hydrateActiveConvolution();

      save(state, userDataDir);
    } catch (error) {
      // A config we cannot read is not a reason to refuse to start. FluidEQ will
      // simply write its own over the top, which is the old behaviour.
      log.warn('Unable to read the existing Equalizer APO config', error);
    }
  };

  return {
    adoptBypassFromConfig,
    adoptExistingApoConfig,
    readCustomFxForDevice,
    syncCustomFxFromConfig,
  };
};
