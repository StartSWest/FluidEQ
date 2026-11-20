/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { IVoicingSettings } from '../../../common/constants';
import type { IDspSettings, IEqSettings } from '../../../common/dsp/chain';
import {
  dspPresetVoicing,
  dspVoicingCurve,
  dspVoicingPresetId,
} from '../../../common/dsp/presetVoicing';
import type { ErrorDescription } from '../../../common/errors';
import {
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../../dsp/dspPresetCatalog';
import { releaseRackHold } from '../../dsp/rackHeldForApo';
import {
  applyDspSettings,
  persistDspSettings,
  readDspSettings,
} from '../../dsp/store';
import {
  addUserDspPreset,
  findUserDspPreset,
  updateUserDspPreset,
} from '../../dsp/userDspPresets';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { setVoicing as setVoicingApi } from '../../utils/equalizerApi';
import { setEqLayerTab } from '../eqLayerTab';
import { flatCurve } from './presetEditBands';
import { settleDraftCurve } from './draftCurveSend';
import { openPresetEditPage } from './presetEditPages';
import {
  endPresetEditSession,
  readPresetEditRestore,
  readPresetEditSession,
  sessionCurve,
  startPresetEditSession,
} from './presetEditSession';

export interface IPresetEditStart {
  presetId: string;
  name: string;
  isNew: boolean;
  curve: IEqSettings;
  rack: IDspSettings;
}

/**
 * Opening, keeping and throwing away a preset being edited
 * (`presetEditSession.ts`). Each ends on the EQ page; Save and Discard on its
 * Preset tab, where the preset just made or left stands in Yours.
 */
const usePresetEditActions = () => {
  const { voicing, setVoicing, setGlobalError } = useFluidEqLayers();
  const [isBusy, setBusy] = useState(false);

  /** The draft's rack and curve put on, and the EQ page on its curve. */
  const begin = (start: IPresetEditStart) => {
    startPresetEditSession(start, { dsp: readDspSettings(), voicing });
    // The rack is the DSP page's own while the session lasts: what it plays
    // is what Save keeps. Off under Equalizer APO for a quick pick, so the
    // hold that keeps it off is let go here, where it is edited on purpose.
    releaseRackHold();
    applyDspSettings({
      ...start.rack,
      enabled: true,
      presetId: start.presetId,
    });
    persistDspSettings();
    openPresetEditPage('eq');
  };

  /**
   * One of the listener's own, as it was kept: its rack as a pick would put
   * it on (the listener's crossfade, level and head kept), and its curve, or
   * a flat one to shape where it was kept before curves left the rack.
   */
  const beginExisting = (presetId: string) => {
    const saved = findUserDspPreset(presetId);
    const rack = saved && resolveDspPreset(saved.id, readDspSettings());
    if (!saved || !rack) {
      return;
    }
    begin({
      presetId: saved.id,
      name: saved.name,
      isNew: false,
      curve: saved.curve ?? flatCurve(),
      rack,
    });
  };

  /**
   * The layer that played before, played again. A preset's curve is sent as
   * it was heard; any other voicing by its own name and strength.
   */
  const putBack = async (before: IVoicingSettings | undefined) => {
    const presetOfLayer = dspVoicingPresetId(before);
    if (!before?.profileId) {
      await setVoicingApi('', 1);
      setVoicing({ profileId: '', intensity: 1 });
      return;
    }
    if (presetOfLayer === undefined) {
      await setVoicingApi(before.profileId, before.intensity);
      setVoicing(before);
      return;
    }
    const curve =
      (before.intensity === 1
        ? resolveDspPresetCurve(presetOfLayer)
        : undefined) ?? dspVoicingCurve(before);
    if (!curve) {
      await setVoicingApi('', 1);
      setVoicing({ profileId: '', intensity: 1 });
      return;
    }
    await setVoicingApi(before.profileId, 1, curve);
    setVoicing(dspPresetVoicing(presetOfLayer, curve));
  };

  const finish = () => {
    endPresetEditSession();
    setEqLayerTab('preset');
    openPresetEditPage('eq');
  };

  /** Everything as it was before the session; nothing kept. */
  const discard = async () => {
    const restore = readPresetEditRestore();
    if (!readPresetEditSession() || !restore || isBusy) {
      return;
    }
    setBusy(true);
    try {
      await settleDraftCurve(true);
      applyDspSettings(restore.dsp);
      persistDspSettings();
      await putBack(restore.voicing);
      finish();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setBusy(false);
    }
  };

  /**
   * The curve as shaped and the rack as the DSP page holds it, kept together;
   * the preset then stays on, chosen, as a pick would leave it.
   */
  const save = async () => {
    const session = readPresetEditSession();
    if (!session || isBusy) {
      return;
    }
    setBusy(true);
    try {
      const curve = sessionCurve(session);
      await settleDraftCurve(false);
      const rack = readDspSettings();
      const saved = session.isNew
        ? await addUserDspPreset(session.name, rack, curve, session.presetId)
        : await updateUserDspPreset(session.presetId, rack, curve);
      if (saved) {
        applyDspSettings({ ...readDspSettings(), presetId: saved.id });
        persistDspSettings();
      }
      finish();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setBusy(false);
    }
  };

  return { begin, beginExisting, discard, save, isBusy };
};

export default usePresetEditActions;
