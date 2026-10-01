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

import { useCallback, useEffect, useState } from 'react';
import type { IAudioRestartOutcome, TAudioEngine } from 'common/audioEngine';
import { ErrorCode } from 'common/errors';
import type { IEngineSetupResult } from 'main/engineSetup';
import { sameEndpoint } from '../audio/engineTrouble';
import useEngineTrouble from '../audio/useEngineTrouble';
import type { TApoAction } from '../components/AudioEngineDialog';
import { publishSystemDspChain, setDspRackGate } from '../dsp/store';
import { startEqualizerApoInstall } from '../utils/apoInstall';
import {
  attachFluidEngine,
  detachFluidEngine,
  engineInstallsNeeded,
  getAudioEngineStatus,
  installFluidEngine,
  isAwaitingApoInstall,
  repairFluidEngineOutput,
  setAudioEngine,
  updateFluidEngine,
} from '../utils/audioEngineApi';
import { notifyAudioEngineChanged } from '../utils/audioEngineEvents';
import { getAudioDevices } from '../utils/equalizerApi';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { reportError, reportInfo } from '../utils/logger';
import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useEngineMaintenance } from '../utils/useEngineMaintenance';
import useRepairWhenEngineNeverRan, {
  repairSlotKey,
} from '../utils/useRepairWhenEngineNeverRan';

const APO_RESTART_RECOMMENDED_KEY = 'fluideq.apoRestartRecommended';

/**
 * The engine as the shell sees it: which one is running, what is wrong with it
 * on the output being listened to, and every action the window offers on it —
 * the dialog, the repairs, the restart of Windows audio and the notices that
 * lead to them.
 */
const useShellEngine = () => {
  const {
    globalError,
    isLoading,
    isEnabled,
    performHealthCheck,
    refreshState,
  } = useFluidEqShell();
  const { t } = useTranslation();

  // Which engine is processing the audio, held once for the whole shell: the
  // output panels, the troubleshooter and the dialog all read this one answer
  // rather than each asking main for its own copy.
  const { status: engineStatus, refresh: refreshEngineStatus } =
    useAudioEngineStatus();
  const runningEngine = engineStatus?.engine;
  // Whether the FluidEQ Engine is failing where it can be heard: for the
  // notice that says so, and for the DSP rack, which runs nowhere while the
  // engine is off.
  const { trouble: engineTrouble, isOnOutput: isEngineOnOutput } =
    useEngineTrouble(
      runningEngine ?? null,
      engineStatus?.fluid,
      engineStatus?.fluidUpdateReady === true,
    );

  const [showAudioRestartRecommendation, setShowAudioRestartRecommendation] =
    useState(false);
  // Bumped when the engine's card is asked for again — see
  // `handleAskAboutEngine`. A card put away for the session comes back on a
  // press rather than staying away because it was dismissed once.
  const [engineAskCount, setEngineAskCount] = useState(0);
  // The engine is not running the output being listened to, which takes the
  // rack with it (`rackPlacement.ts`).
  //
  // Deliberately not every `isEngineOnOutput === false`: an output the engine
  // was never put on is one of those, and this gate also stops the Library
  // player's own copy of the rack — which processes its own audio and works
  // perfectly well on an output no engine is attached to. Widening it there
  // would silence the rack in the Library to describe the engine.
  const isEngineOff = engineTrouble?.kind === 'off';
  useEffect(() => {
    // Before the publish below, so the first rack of a launch already knows
    // where it may run (`rackPlacement.ts`): under the FluidEQ Engine,
    // FluidEQ switched off or the engine not running leaves it nowhere.
    setDspRackGate({
      engine: runningEngine ?? null,
      eqEnabled: isEnabled,
      engineOff: isEngineOff,
    });
  }, [runningEngine, isEnabled, isEngineOff]);
  useEffect(() => {
    // FluidEQ takes the rack away from the engine when it quits, so the DSP
    // page's own publish — which waits for the page to be opened — would
    // leave every launch running no rack until then.
    if (runningEngine === 'fluid') {
      publishSystemDspChain();
    }
  }, [runningEngine]);
  const [showEngineDialog, setShowEngineDialog] = useState(false);

  useEffect(() => {
    if (globalError?.code === ErrorCode.EQUALIZER_APO_NOT_INSTALLED) {
      localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
      return;
    }

    if (
      !isLoading &&
      !globalError &&
      localStorage.getItem(APO_RESTART_RECOMMENDED_KEY) === 'true'
    ) {
      setShowAudioRestartRecommendation(true);
    }
  }, [globalError, isLoading]);

  const handleConfigureEqualizerApo = async () => {
    const error =
      await window.electron.ipcRenderer.openEqualizerApoConfigurator();
    if (error) {
      await window.electron.ipcRenderer.showNativeMessage(error);
      return false;
    }
    localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
    setShowAudioRestartRecommendation(true);
    return true;
  };

  /**
   * Run Equalizer APO's installer again, over the top of itself.
   *
   * Its setup is a repair as much as an install: it re-registers the APO and
   * reopens the Device Selector, which is what fixes an endpoint Windows has
   * detached it from. The bundled copy is still in the install directory, so
   * nothing is downloaded.
   */
  const handleReinstallApo = async () => {
    // Asked first, and the label's ellipsis is a promise that it will be.
    //
    // This raises a Windows permission prompt, reinstalls the component that
    // processes all of the machine's audio, and needs a restart afterwards.
    // None of that should happen because somebody was reading the menu with a
    // mouse in their hand.
    const confirmed = await window.electron.ipcRenderer.confirmNative(
      t('app.apoReinstall.confirm'),
      t('whatsNew.ok'),
      t('config.cancel'),
    );
    if (!confirmed) {
      return;
    }
    const outcome = await startEqualizerApoInstall();

    if (outcome === 'bundle-missing') {
      // The download page is already opening. Saying so beats the generic
      // error banner this used to raise, which showed the literal sentinel
      // `apo-bundle-missing` over "Please restart the application" — no
      // download, and nothing anybody could act on.
      await window.electron.ipcRenderer.showNativeMessage(
        t('app.apoReinstall.noBundle'),
      );
      return;
    }

    if (outcome === 'not-started') {
      await window.electron.ipcRenderer.showNativeMessage(
        t('app.apoReinstall.notStarted'),
      );
      return;
    }

    // Same as reconfiguring, and more certainly so: a reinstalled APO is not
    // in the audio chain until the endpoints are rebuilt. Reconfigure has
    // always said this; a reinstall staying silent about it would leave
    // somebody deciding the repair had not worked.
    localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
    setShowAudioRestartRecommendation(true);
  };

  const handleOpenEqualizerApoSettings = async () => {
    const error = await window.electron.ipcRenderer.openEqualizerApoSettings();
    if (error) {
      await window.electron.ipcRenderer.showNativeMessage(error);
    }
  };

  // Stable, so the DSP page it is handed to keeps its memo.
  const handleOpenEngineDialog = useCallback(() => {
    // Asked again on the way in: the answer can have changed since the window
    // opened — Equalizer APO installed from outside, the engine attached to a
    // new output — and this dialog is where that is acted on.
    refreshEngineStatus();
    setShowEngineDialog(true);
  }, [refreshEngineStatus]);

  /**
   * Put the chosen engine in place, in the order that leaves the machine
   * usable if any step of it fails.
   *
   * Install first, then record the choice: a preference naming an engine that
   * is not on disk is the `FLUID_ENGINE_NOT_INSTALLED` wall, and reaching it
   * because the user closed a Windows prompt would be this dialog's own doing.
   * Equalizer APO is the other way round — its setup is a separate program
   * that needs a Windows restart, so the choice is saved first and the setup
   * run after, and the config it will read is already on disk when it is.
   *
   * The status is re-read here rather than taken from the hook's snapshot:
   * the dialog can have been open since before either engine was installed,
   * and acting on a stale `installed: false` runs an installer the machine
   * does not need — which is how switching back to Equalizer APO used to
   * re-run its installer and ask for a reboot.
   */
  const handleApplyAudioEngine = async (engine: TAudioEngine) => {
    const fresh = await getAudioEngineStatus().catch((error) => {
      reportError('the audio engine status could not be read', error);
      return undefined;
    });
    const needed = engineInstallsNeeded(engine, fresh);
    if (needed.fluid) {
      const result = await installFluidEngine();
      if (result.declined) {
        throw new Error('declined');
      }
      if (!result.ok) {
        throw new Error(result.error ?? 'engine setup failed');
      }
    }
    try {
      await setAudioEngine(engine);
    } catch (error) {
      if (!isAwaitingApoInstall(error, needed)) {
        throw error;
      }
    }
    if (needed.apo) {
      await startEqualizerApoInstall();
      localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
      setShowAudioRestartRecommendation(true);
    }
    notifyAudioEngineChanged();
    await refreshEngineStatus();
    performHealthCheck();
    // The dialog stays open: comparing the two engines is done by switching
    // back and forth while something plays, and a dialog that closed on
    // every Apply made each comparison a trip through the menu. The blocking
    // first-run copy still goes away by itself, because choosing an engine
    // is what un-blocks it.
  };

  const handleApoAction = (action: TApoAction) => {
    setShowEngineDialog(false);
    if (action === 'reconfigure') {
      handleConfigureEqualizerApo();
    } else if (action === 'settings') {
      handleOpenEqualizerApoSettings();
    } else {
      handleReinstallApo();
    }
  };

  /** One output through the engine, from the notice that says it is not. */
  const handleAttachFluidEngine = async (guid: string) => {
    const result = await attachFluidEngine(guid);
    if (result.ok) {
      await refreshEngineStatus();
      performHealthCheck();
    }
    return result;
  };

  /**
   * The single button on the blocking `FLUID_ENGINE_NOT_INSTALLED` banner.
   *
   * Returns the result rather than swallowing it: a declined Windows prompt
   * or an outright failure is an answer the banner has to show, not silence
   * that leaves the button looking like it did nothing.
   */
  const handleInstallFluidEngine = async (): Promise<IEngineSetupResult> => {
    const result = await installFluidEngine();
    if (result.ok) {
      notifyAudioEngineChanged();
      await refreshEngineStatus();
      performHealthCheck();
    }
    return result;
  };

  /**
   * The banner's Retry asks the engine again before checking health.
   *
   * The check alone answers from what the engine last said about itself, so
   * after a moment when it could not be asked — Windows Audio restarting, or
   * not up yet at login — Retry kept showing the same wall until the app was
   * restarted.
   */
  const handlePrereqRetry = async () => {
    await refreshEngineStatus();
    performHealthCheck();
  };

  /**
   * The troubleshooter's own "put the engine back" step.
   *
   * It has no inline error slot of its own — unlike the blocking banner and
   * the output notice, its steps are a list of buttons with no room kept for
   * a result line — so a declined or failed attempt is surfaced through the
   * native message box the rest of the app already uses for this kind of
   * one-shot outcome.
   */
  const handleTroubleshootEnableEngine = async () => {
    const result = await handleInstallFluidEngine();
    if (!result.ok) {
      await window.electron.ipcRenderer.showNativeMessage(
        t(result.declined ? 'engine.declined' : 'engine.failed'),
      );
    }
  };

  /** One output off the engine again, with its old effect chain restored. */
  const handleDetachFluidEngine = async (guid: string) => {
    const result = await detachFluidEngine(guid);
    if (result.ok) {
      notifyAudioEngineChanged();
      await refreshEngineStatus();
      performHealthCheck();
    }
    return result;
  };

  /**
   * The troubleshooter's "take it off this output" step.
   *
   * The output is resolved here rather than passed down: the troubleshooter
   * has no device list of its own, and "this output" means the one Windows is
   * playing through — the same device the rest of the shell is showing. An
   * output list that cannot be read, a declined prompt and an outright
   * failure all come back through the same native message box the Enable step
   * uses, because this panel's steps have no inline slot for a result line.
   */
  const handleTroubleshootRemoveEngine = async () => {
    const devices = await getAudioDevices().catch((error) => {
      reportError('the audio outputs could not be read', error);
      return undefined;
    });
    const current = devices?.find((device) => device.isDefault);
    if (!current) {
      await window.electron.ipcRenderer.showNativeMessage(
        t('engine.detachFailed'),
      );
      return;
    }
    const result = await handleDetachFluidEngine(current.guid);
    if (!result.ok) {
      await window.electron.ipcRenderer.showNativeMessage(
        t(result.declined ? 'engine.declined' : 'engine.detachFailed'),
      );
    }
  };

  /**
   * The restart itself, run by the card's own button through
   * `useAudioRestart`, which owns it so it outlives the card. The card shows
   * the outcome, so there is no message box here any more.
   */
  const performWindowsAudioRestart =
    async (): Promise<IAudioRestartOutcome> => {
      const outcome = await window.electron.ipcRenderer.restartWindowsAudio();
      if (outcome.ok) {
        localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
        setShowAudioRestartRecommendation(false);
        /**
         * Audiosrv came back; the loopback stream did not necessarily come
         * with it.
         *
         * Chromium can keep the old capture track `live` after Windows
         * invalidates its endpoint, feeding silence forever. A retry is not
         * enough because the capture sees that live track and correctly
         * refuses to open a duplicate. The output-change path is the owner of
         * a full rebind: it removes the track listeners, stops every track,
         * disconnects the analyser graph, closes its AudioContext and clears
         * its pump before opening a fresh loopback. Reusing that path also
         * means repeated restart notifications are coalesced instead of
         * accumulating streams or timers.
         */
        window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
        performHealthCheck();
      }
      return outcome;
    };

  /**
   * This app's engine in place of the one installed, run by the update
   * notice's own button through `useEngineUpdate`, which owns it so it
   * outlives the notice.
   *
   * It ends in a restart of Windows audio, so it is followed by what a
   * restart is followed by: the capture rebuilt on the restarted output, and
   * the health check. The status is read again whatever the answer, so the
   * notice is offered only while there is still an engine to install.
   */
  const afterEngineChanged = async (outcome: IAudioRestartOutcome) => {
    if (outcome.ok) {
      localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
      setShowAudioRestartRecommendation(false);
      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
      await refreshState();
    }
    await refreshEngineStatus();
    return outcome;
  };
  const performEngineUpdate = async (): Promise<IAudioRestartOutcome> =>
    afterEngineChanged(await updateFluidEngine());
  // Main's own repair of one output, which ends the way an update does.
  const performEngineRepair = async (
    guid: string,
  ): Promise<IAudioRestartOutcome> =>
    afterEngineChanged(await repairFluidEngineOutput(guid));

  const { audioRestart, engineUpdate, repairEngine, suppressAudioNotices } =
    useEngineMaintenance(
      engineStatus?.engine === 'fluid' && engineStatus.fluidUpdateReady,
      performWindowsAudioRestart,
      performEngineUpdate,
      performEngineRepair,
    );
  // Never restarted by itself. The engine on the output being listened to
  // and Windows not running it used to get Windows audio restarted the
  // moment sound was heard — once a session, without a press — and that
  // restart is an elevated run of the setup helper, so every change of
  // output to one Windows had built before the engine was on it put a
  // Windows prompt up with nobody having asked. The trouble card asks
  // instead: its Restart button is the one thing that runs it.
  /**
   * The bypassed-engine card's own button: move the engine to another of the
   * output's effect slots, because Windows is playing that output through a
   * chain it is not in. Pressed, never automatic — one Windows prompt.
   */
  const handleTryAnotherSlot = (guid: string) => {
    reportInfo(
      `Moving the engine on ${guid} to another slot: it was asked for, on an ` +
        'output whose sound has never reached the engine',
    );
    repairEngine(guid).catch((error) =>
      reportError('The engine could not be moved to another slot', error),
    );
  };

  /**
   * The side bar's switch, pressed back on while it reads off because the
   * engine is not reaching this output.
   *
   * It asks; it never installs. Every repair on the engine's card is an
   * elevated run of the setup helper, so running one on a switch press would
   * put a Windows prompt up each time the switch was touched — for nothing,
   * most times, since the card already offers only the repair that fits the
   * fault. Where there is no card, the engine's own dialog is where an engine
   * is installed or swapped, and it says what is on this machine first.
   */
  const handleAskAboutEngine = () => {
    if (engineTrouble !== undefined) {
      setEngineAskCount((count) => count + 1);
      return;
    }
    handleOpenEngineDialog();
  };

  /**
   * The rack card's own button: put this app's engine in place.
   *
   * A rack the engine could not start is the one trouble a restart of
   * Windows audio cannot mend — it brings back the same engine, which fails
   * the same way. A user with a half-installed engine hit exactly that: the
   * EQ played, every DSP effect was off, the card's restart did nothing, and
   * what mended it was this same step found by hand on the help page.
   */
  const handleInstallEngineForTrouble = () => {
    handleTroubleshootEnableEngine().catch((error) =>
      reportError('The engine could not be put in place', error),
    );
  };

  // Where Windows has never created the engine on the output, a restart
  // cannot help; putting the install back, or moving the engine to a slot
  // the driver builds, can — the slot ladder, bounded and silent by design.
  // Keyed by the slot the helper reports (`repairSlotKey`), so each rung is
  // asked for once.
  const troubledSlot = repairSlotKey(
    engineTrouble?.kind === 'off'
      ? engineStatus?.fluid.endpoints.find((endpoint) =>
          sameEndpoint(endpoint.guid, engineTrouble.device.guid),
        )
      : undefined,
  );
  const { isTryingSlots } = useRepairWhenEngineNeverRan(
    engineTrouble,
    suppressAudioNotices,
    repairEngine,
    troubledSlot,
  );

  const dismissAudioRestartRecommendation = () => {
    localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
    setShowAudioRestartRecommendation(false);
  };

  return {
    engineStatus,
    runningEngine,
    engineTrouble,
    isEngineOnOutput,
    showAudioRestartRecommendation,
    dismissAudioRestartRecommendation,
    engineAskCount,
    showEngineDialog,
    closeEngineDialog: () => setShowEngineDialog(false),
    handleOpenEngineDialog,
    handleConfigureEqualizerApo,
    handleReinstallApo,
    handleApplyAudioEngine,
    handleApoAction,
    handleAttachFluidEngine,
    handleInstallFluidEngine,
    handlePrereqRetry,
    handleTroubleshootEnableEngine,
    handleTroubleshootRemoveEngine,
    audioRestart,
    engineUpdate,
    suppressAudioNotices,
    handleRestartWindowsAudio: audioRestart.open,
    handleTryAnotherSlot,
    handleAskAboutEngine,
    handleInstallEngineForTrouble,
    isTryingSlots,
  };
};

export default useShellEngine;
