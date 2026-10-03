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

import log from 'electron-log';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  AUTOMATIC_PRESET_PREFIX,
  AutoEqFormat,
  FixedBandSizeEnum,
  getDefaultFilters,
  IDeviceProfileSettings,
  IFiltersMap,
  IPresetV2,
  IState,
  MAX_GAIN,
  TApoLayer,
} from '../common/constants';
import { getCurveEqMode, getEqMode } from '../common/eqMode';
import type { ILayoutSnapshot } from '../common/layouts';
import { compressChainToLimit } from '../common/response';
import { hydrateConvolutionAnalysis } from './convolutionAnalysis';
import { ISessionHeadroom } from './deviceProfiles';
import {
  assignDeviceProfile,
  migrateNamedFilesToOutputFolders,
  saveDeviceProfileSettings,
} from './deviceProfileSettings';
import {
  doesPresetExist,
  PRESET_BASELINES_DIR,
  PRESETS_DIR,
  repairUnusedPreamps,
  savePreset,
} from './flush';
import { createLayoutSettingsStore } from './layoutSettings';
import type { IMainSession } from './mainSession';

export const getAutomaticPresetName = (deviceId: string) =>
  `${AUTOMATIC_PRESET_PREFIX}${createHash('sha1')
    .update(deviceId)
    .digest('hex')
    .slice(0, 12)}`;

export const isAutomaticPresetName = (presetName: string) =>
  presetName.startsWith(AUTOMATIC_PRESET_PREFIX);

/**
 * Where one output's profiles live.
 *
 * Profiles belong to an output, not to the app. A pair of headphones and a set
 * of speakers want different tunings, and the name the user picks for one has
 * nothing to say about the other — "Bass boost" on the headphones and "Bass
 * boost" on the speakers are two different profiles that happen to share a
 * word.
 *
 * A folder each is what makes that true on disk. They used to share one flat
 * directory, where a profile *was* its filename, so two outputs could not both
 * hold a "Bass boost" and saving on one silently overwrote the other. The old
 * defence was to rename the second one "Bass boost 2" — a name the user never
 * typed, attached to an output they were not looking at.
 *
 * The directory is named by hashing the device id rather than using it: device
 * ids are long, contain characters Windows will not accept in a path, and are
 * not something anybody should have to look at. The same hash already names
 * the automatic profile, so both agree on what identifies an output.
 */
const outputSlug = (deviceId: string) =>
  createHash('sha1').update(deviceId).digest('hex').slice(0, 12);

/**
 * The shield in front of every reference this app applies on somebody's behalf.
 *
 * A published measurement is a claim, and some of them are wrong. A model with
 * no flat baseline to subtract from can arrive as a negated raw SPL curve —
 * read literally, a correction of fifty decibels of cut across the whole
 * midrange. It was applied, it was written to Equalizer APO, and the output
 * went silent.
 *
 * Nothing downstream could have caught it. The per-band ceiling did fire: it
 * trimmed eleven separate bands to -12 dB, and eleven legal bands still summed
 * to -50, because a limit on each band is not a limit on the chain. The preamp
 * could not catch it either — it only ever attenuates, so a chain that has
 * already thrown away fifty decibels is not something it can give back.
 *
 * So the chain itself is bounded here, once, before any of it is applied.
 * Compressed rather than clipped, so a correction that is merely strong keeps
 * the shape the measurement asked for and only gets gentler; one already inside
 * the range is passed through untouched and costs nothing.
 *
 * Deliberately not applied to a profile the user loads. Their own tuning is
 * theirs, however extreme, and quietly rescaling a saved profile on load would
 * change a sound they chose and kept.
 *
 * `limit` is a slider's ±20 dB for bands headed for the user's own EQ. A
 * headphone correction is given a correction's range (`correctionRange.ts`):
 * it plays as published, and only a chain past what the preamp can take back
 * is compressed. The fifty-decibel curve above was built out of a raw Squiglink
 * measurement; every correction applied now arrives as a published fit, from
 * OPRA or a pasted EQ export.
 */
export const shieldReferenceBands = (filters: IFiltersMap, limit = MAX_GAIN) =>
  compressChainToLimit(filters, limit);

/**
 * Give the active output an empty named profile.
 *
 * Every output keeps at least one, so there is always somewhere for an edit to
 * land and always something in the list to select. The number counts only this
 * output's own profiles, so each output starts again at "Untitled profile 1" —
 * a second output has no reason to open on "Untitled profile 4" because three
 * unrelated ones exist on the speakers.
 */
const UNTITLED_PROFILE_PREFIX = 'Untitled profile';

export interface IProfileStoreDeps {
  state: IState;
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  userDataDir: string;
}

/**
 * The EQ state and the profiles each output keeps: where they live on disk,
 * what a profile carries, and the resets and mutations every handler shares.
 */
export const createProfileStore = ({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
}: IProfileStoreDeps) => {
  const presetPath = path.join(userDataDir, PRESETS_DIR);
  const baselinePath = path.join(userDataDir, PRESET_BASELINES_DIR);

  /** Backfill measured WAV metadata for profiles created before strict
   * convolution normalization existed. The file analyzer caches by mtime, so
   * repeated state reads do not repeat the FFT.
   */
  const hydrateActiveConvolution = () => {
    if (!session.configPath || !state.convolution?.fileName) {
      return false;
    }
    try {
      const hydrated = hydrateConvolutionAnalysis(
        state.convolution,
        session.configPath,
      );
      if (hydrated !== state.convolution) {
        state.convolution = hydrated;
        return true;
      }
    } catch (error) {
      log.warn('Unable to analyze the active convolution WAV', error);
    }
    return false;
  };

  const layoutSettings = createLayoutSettingsStore(userDataDir);

  const getLayoutDeviceKey = () => session.activeAudioDeviceId || 'global';

  const captureCurrentLayout = () => {
    layoutSettings.capture(getLayoutDeviceKey(), state.filters);
  };

  const clearCurrentLayoutSettings = () => {
    layoutSettings.clear(getLayoutDeviceKey());
  };

  const getStoredLayout = (
    size: FixedBandSizeEnum,
  ): ILayoutSnapshot | undefined =>
    layoutSettings.stored(getLayoutDeviceKey(), size);

  const presetDirForDevice = (deviceId: string) => {
    const dir = path.join(presetPath, outputSlug(deviceId));
    // No output, no folder.
    //
    // The renderer asks for the profile list as it mounts, which is before any
    // device has been resolved, so this ran with an empty id — and hashing the
    // empty string is a perfectly good hash. Every install ended up with a
    // `da39a3ee5e6b` directory that could never hold a profile, because no
    // output will ever have that id. Found by looking in a real profile
    // directory.
    //
    // The path is still returned rather than thrown, because the caller asking
    // is a list that should come back empty, not an error: the list handler
    // answers a folder that is not there with no profiles
    // (`GET_PRESET_FILE_LIST` in `ipc/profiles.ts`) — `readdirSync` itself
    // throws on one, which is what put an error in front of every launch.
    if (!deviceId) {
      return dir;
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  /** The folder for whichever output is playing now. */
  const activePresetDir = () => presetDirForDevice(session.activeAudioDeviceId);

  /**
   * Where one output's hand-saved copies live — the same split, for the same
   * reason.
   *
   * A baseline is the profile as it stood at the last explicit Save, and it is
   * the only thing Restore can put back. These sat in one flat directory keyed
   * by name alone long after profiles stopped doing so, which made them collide
   * exactly the way profiles used to: five outputs attached to "Untitled
   * profile 1" shared one file, so saving on any of them overwrote the undo
   * point of the other four, and renaming on one took the file away from all
   * of them.
   *
   * Deliberately does not create the directory. `savePresetBaseline` makes it
   * when there is finally something to put in it, and every reader here treats
   * a missing folder as "no saved copy", which is the truth for an output
   * nobody has pressed Save on.
   */
  const baselineDirForDevice = (deviceId: string) =>
    path.join(baselinePath, outputSlug(deviceId));

  /** The saved-copy folder for whichever output is playing now. */
  const activeBaselineDir = () =>
    baselineDirForDevice(session.activeAudioDeviceId);

  /**
   * Put the profile store in order before anything reads from it.
   *
   * The move has to come first: the repair looks inside each output's folder,
   * and before the move there are no folders to look in. Running them the
   * other way round would quietly skip every profile that still needed
   * repairing.
   *
   * Automatic profiles that carry makeup gain but no EQ to make up for are
   * leftovers from when switching outputs copied the previous device's state
   * across; the effect is an output several dB down for no reason, which is
   * not something a user would ever notice as a setting.
   */
  const runStartupProfileMaintenance = () => {
    migrateNamedFilesToOutputFolders(
      deviceProfileSettings,
      presetPath,
      presetDirForDevice,
      'profile',
    );
    // The saved copies were left flat by the first split and are being caught
    // up now. Same move, one release later.
    migrateNamedFilesToOutputFolders(
      deviceProfileSettings,
      baselinePath,
      baselineDirForDevice,
      'saved copy',
    );

    const repaired = Object.values(deviceProfileSettings.assignments).flatMap(
      (assignment) =>
        repairUnusedPreamps(presetDirForDevice(assignment.deviceId)),
    );
    if (repaired.length > 0) {
      log.info(
        `Cleared unused preamp on ${repaired.length} automatic profile(s):`,
        repaired.join(', '),
      );
    }
  };

  /**
   * Swap the live state over to what a different output is tuned to.
   *
   * Everything a profile can carry moves — bands, preamp, voicing, driver
   * correction, convolution — because all of it was chosen for the headphones
   * or speakers on that endpoint and means nothing on another one. Only the
   * four app-wide preferences below stay put: whether the engine is on,
   * whether the graph is showing, what the filesystem is like, and the cuts,
   * which are written for every output at once. They live in the same IState
   * as the EQ, so assigning a device's state wholesale used to turn the engine
   * back on for anyone who had switched it off, simply because Windows changed
   * the default output.
   */
  const applyDeviceState = (next: IState) => {
    const {
      isEnabled,
      isGraphViewOn,
      isCaseSensitiveFs,
      eqCuts,
      ...deviceState
    } = next;
    Object.assign(state, deviceState);
    // The measurement belongs to the endpoint it was heard on and to nothing
    // else. A profile carries none, so the spread above cannot clear it, and
    // leaving it would hand the new output a reserve sized for music that went
    // through the old one. The capture starts again from no opinion, which is
    // the worst case — the same place a cold start begins.
    state.smartHeadroomProgramme = undefined;
    state.smartHeadroomTrimDb = undefined;
  };

  const getCurrentPreset = (): IPresetV2 => ({
    preAmp: state.preAmp,
    filters: state.filters,
    eqFormat: state.eqFormat,
    graphicEq: state.graphicEq,
    convolution: state.convolution,
    isFlat: state.isFlat,
    eqMode: getEqMode(state),
    curveEqMode: getCurveEqMode(state),
    mainBandQ: state.mainBandQ,
    eqBandQ: state.eqBandQ,
    curveBandQ: state.curveBandQ,
    curveSmoothing: state.curveSmoothing,
    eqBandDesign: state.eqBandDesign,
    isEqDoubleOn: getEqMode(state) === 'double',
    // Without these the device-profile block is rendered from a preset that
    // has no idea they exist, and every one of the layers vanishes from the
    // config the moment a profile is attached — which is always, since every
    // output is given one.
    //
    // Any layer added later belongs in this list, and one of them was missed
    // for months: it could be switched on, drawn and reasoned about, and it
    // reached Equalizer APO exactly never, because the session override
    // rendered it from the state while the profile was written without it —
    // and the profile is what the config is built from.
    tone: state.tone,
    voicing: state.voicing,
    driver: state.driver,
    smartEq: state.smartEq,
    headphone: state.headphone,
    eqImport: state.eqImport,
    isAutoPreAmpOn: state.isAutoPreAmpOn,
    headset: state.headset,
    headsetTarget: state.headsetTarget,
    headsetSource: state.headsetSource,
    // Which layers are switched off is part of what this profile sounds like,
    // so it travels with it — otherwise switching outputs and back would bring
    // every bypassed layer roaring back in.
    bypassed: state.bypassed,
  });

  /**
   * The live measurement, addressed to the output it was taken on.
   *
   * Every flush needs this, because the writer reserves headroom from the
   * saved profile and the profile is not allowed to hold a measurement. Leave
   * it out of a flush and that flush writes the worst case — which, on any
   * path that runs while music is playing, is a jump back up to full
   * attenuation and then a whole ramp back down again.
   */
  const sessionHeadroom = (): ISessionHeadroom => ({
    deviceId: session.activeAudioDeviceId,
    programme: state.smartHeadroomProgramme,
    trimDb: state.smartHeadroomTrimDb,
  });

  const switchToParametricEditing = () => {
    state.eqFormat = AutoEqFormat.PARAMETRIC;
    state.graphicEq = undefined;
  };

  /**
   * A free name for a profile about to be created on this output.
   *
   * For creating only — never for saving into a profile that already exists.
   * Profiles are files named after the profile, so a second one of the same
   * name on one output really would be the same file, and a number is appended
   * the way a file manager does it.
   *
   * Only this output's own folder is consulted, because that is the only place
   * a name can collide now: each output keeps its profiles in a folder of its
   * own, so what the speakers call their profiles has no bearing on the
   * headphones. Asking this question on the way into a *save* is what made
   * Update duplicate the profile it was meant to overwrite — the name was
   * "taken" by the very profile being updated.
   */
  const availableProfileNameForActiveDevice = (requestedName: string) => {
    const dir = activePresetDir();
    if (!doesPresetExist(requestedName, dir)) {
      return requestedName;
    }
    let index = 2;
    while (doesPresetExist(`${requestedName} ${index}`, dir)) {
      index += 1;
    }
    return `${requestedName} ${index}`;
  };

  /**
   * A layer applied afresh is applied, whatever was switched off before it.
   *
   * Called where a layer's settings arrive or are taken away, not where they
   * are edited. Choosing a voicing, finishing a measurement, applying a
   * reference model — each of those is somebody asking to hear something, and
   * handing them silence because the previous occupant of that slot was
   * switched off is the one thing an applied layer must never do. Clearing one
   * has to do it too: the chip goes with the layer, and a list still naming it
   * would leave nothing on screen able to switch it back on.
   *
   * Moving a band while its layer is bypassed is a different act. The chip is
   * visibly off, and preparing a tuning before switching it in is a reasonable
   * thing to want.
   */
  const applyingLayer = (layer: TApoLayer) => {
    if (!state.bypassed?.includes(layer)) {
      return;
    }
    const rest = state.bypassed.filter((entry) => entry !== layer);
    state.bypassed = rest.length ? rest : undefined;
  };

  /**
   * Back to the default editable EQ: ten neutral Peak bands and no preamp.
   *
   * The default layout rather than only zeroed gains, because band pass, notch
   * and the pass filters still shape the signal at 0 dB, and because the stored
   * per-size layout snapshots have to go with them — otherwise pressing a band
   * count afterwards resurrects the tuning that was just cleared. The flat flag
   * is what actually takes the bands out of the config; without it they would
   * be stored and then never written.
   *
   * The attribution goes too: it described bands that no longer exist. Nothing
   * here touches the voicing, the driver correction, the Smart EQ correction or
   * the convolution — those are separate layers, arrived at separately, and
   * clearing the EQ is not a reason to throw them away. Smart EQ in particular
   * is measured rather than chosen, so clearing the reference cannot invalidate
   * it: it describes what came out of the speakers, not what went into the
   * bands. See resetStateToDefaults for the reset that does clear everything.
   */
  const resetEqToDefaults = () => {
    switchToParametricEditing();
    clearCurrentLayoutSettings();
    state.filters = getDefaultFilters();
    state.preAmp = 0;
    state.isFlat = true;
    state.isEqDoubleOn = false;
    state.eqMode = 'normal';
    state.curveEqMode = 'normal';
    state.mainBandQ = undefined;
    state.eqBandQ = undefined;
    state.curveBandQ = undefined;
    state.curveSmoothing = undefined;
    state.eqBandDesign = undefined;
    /*
     * THE REFERENCE IS NOT CLEARED HERE, BECAUSE THESE ARE NOT ITS BANDS.
     *
     * The other half of the swap recorded on CLEAR_HEADSET. Clearing the bands
     * used to mean clearing the reference, because the reference WAS the
     * bands; now it is a layer of its own and survives this untouched. What
     * did not survive was its name: `state.headphone` stayed applied and
     * audible while `headset` went to undefined, so the picker said "No
     * reference applied" over a correction that was still playing — and the
     * only way back was to clear a reference the screen insisted was not
     * there.
     *
     * `eqImport` still goes, because that one really does describe these
     * bands.
     */
    state.eqImport = undefined;
    // The bands are gone, so the switch that was holding them out of the
    // config has nothing left to hold. Without this, clearing a bypassed EQ
    // takes the chip off the row — no shaped bands, no reference, nothing to
    // draw it — and leaves the feature on the bypass list, so the next tuning
    // somebody builds is written nowhere and there is no control left to
    // explain why.
    applyingLayer('eq');
  };

  /**
   * Put the sound back to neutral: no bands, no layers, no attribution.
   *
   * Everything audible, and everything describing it. Leaving the voicing, the
   * driver correction or the measured Smart EQ curve behind after a reset
   * would mean the EQ page said "flat" while three layers were still shaping
   * the output.
   */
  const resetStateToDefaults = () => {
    resetEqToDefaults();
    state.convolution = undefined;
    state.tone = undefined;
    state.voicing = undefined;
    state.driver = undefined;
    state.smartEq = undefined;
    // Nothing is left to be switched off. Keeping the list would leave the
    // next layer applied here silent for a reason nothing on screen accounts
    // for.
    state.bypassed = undefined;
  };

  /**
   * One profile mutation at a time, in the order they arrived.
   *
   * These handlers are `async` and every `await` in them is a place another
   * one can start. They share three things — `deviceProfileSettings`, the
   * equaliser `state`, and the config on disk — so two that overlap are not
   * two operations but one interleaved mess.
   *
   * Deleting several profiles quickly is where it shows, because delete is the
   * longest of them. Two deletes that both removed the profile their output
   * was playing each reach `createEmptyProfileForActiveDevice`, and each counts
   * the catalogue *before* the other has written to it, so both pick the same
   * number and one silently loses. Meanwhile both are part-way through
   * `removeAssignmentForPreset` on the same object and both call
   * `handleUpdate`, so the config is rewritten from a state that is halfway
   * between two edits. Nothing throws. The list simply comes back wrong.
   *
   * A chain rather than a lock, because a lock needs releasing on every path
   * out — including the ones that throw — and this cannot be forgotten. The
   * failure handler on the tail is what keeps the queue alive: without it, one
   * rejected mutation would leave every later one waiting on a promise that
   * never settles, which turns a wrong list into a dead panel.
   *
   * It does NOT serialise the whole application. Reads are untouched, and so
   * is everything that does not write to these three things.
   */
  let profileMutations: Promise<unknown> = Promise.resolve();

  const runProfileMutation = (work: () => Promise<void>): Promise<void> => {
    const next = profileMutations.then(work, work);
    profileMutations = next.catch(() => undefined);
    return next;
  };

  const attachPresetToActiveDevice = (presetName: string) => {
    if (!session.activeAudioDeviceId) {
      return false;
    }

    const device = session.activeAudioDevice;
    assignDeviceProfile(deviceProfileSettings, {
      deviceId: session.activeAudioDeviceId,
      deviceName: device?.name || session.activeAudioDeviceId,
      deviceGuid: device?.guid || session.activeAudioDeviceId,
      presetName,
    });
    saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
    session.hasActiveSessionOverride = false;
    return true;
  };

  const createEmptyProfileForActiveDevice = () => {
    if (!session.activeAudioDeviceId) {
      return;
    }
    const dir = activePresetDir();
    let index = 1;
    while (doesPresetExist(`${UNTITLED_PROFILE_PREFIX} ${index}`, dir)) {
      index += 1;
    }
    const name = `${UNTITLED_PROFILE_PREFIX} ${index}`;
    savePreset(name, getCurrentPreset(), dir, 'profile-created');
    attachPresetToActiveDevice(name);
  };

  /**
   * The profile root, its per-output folders and their repairs, before
   * anything reads from them; and the case-sensitivity the profile names need.
   */
  const prepareProfileFolders = () => {
    try {
      // create presets dir if it doesn't exist
      if (!fs.existsSync(presetPath)) {
        fs.mkdirSync(presetPath, { recursive: true });
      }
    } catch (e) {
      log.error('Failed to make presets directory!!');
      log.error(e);
      throw e;
    }

    // Only once the root exists, since every output's folder is made inside it.
    runStartupProfileMaintenance();

    // spawn child process to update presets folder so that it can support
    // case-sensitive files
    if (process.platform === 'win32') {
      // `execFile`, not `exec`: the path goes across as an argument rather than
      // being pasted into a command line for a shell to re-parse. It comes from
      // `app.getPath('userData')` so there is nothing hostile in it today, but
      // the quoting was the only thing standing between that and a shell, and
      // this needs no shell at all.
      execFile(
        'fsutil.exe',
        ['file', 'SetCaseSensitiveInfo', presetPath],
        (err, stdout, stderr) => {
          // Error handling should occur in this callback function
          if (err) {
            log.error(err.message.trim());
            log.error(stdout.trim());
            log.error(stderr.trim());
            return;
          }

          // Set case sensitive to true if an error was not thrown
          state.isCaseSensitiveFs = true;
        },
      );
    }
  };

  return {
    hydrateActiveConvolution,
    captureCurrentLayout,
    clearCurrentLayoutSettings,
    getStoredLayout,
    presetDirForDevice,
    activePresetDir,
    activeBaselineDir,
    applyDeviceState,
    getCurrentPreset,
    sessionHeadroom,
    switchToParametricEditing,
    availableProfileNameForActiveDevice,
    applyingLayer,
    resetEqToDefaults,
    resetStateToDefaults,
    runProfileMutation,
    attachPresetToActiveDevice,
    createEmptyProfileForActiveDevice,
    prepareProfileFolders,
  };
};

export type TProfileStore = ReturnType<typeof createProfileStore>;
