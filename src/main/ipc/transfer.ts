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
import { BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import {
  IAudioDevice,
  IDeviceProfileSettings,
  IFiltersMap,
  IState,
  TApoLayer,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import ChannelEnum from '../../common/channels';
import { PRODUCT_NAME } from '../../common/branding';
import {
  CHAIN_BUNDLE_EXTENSION,
  IChainBundle,
  IChainImport,
  chainBundleFileName,
  isSafeImportedCustomBlock,
  parseChainBundle,
  serializeChainBundle,
} from '../../common/chainBundle';
import { parseEqText } from '../../common/apoText';
import { fetchPreset, savePreset, savePresetBaseline } from '../flush';
import { getCustomFileNameForDevice } from '../deviceProfiles';
import { getConfigPath } from '../registry';
import { importConvolutionFile, importEqFile } from '../importSettings';
import { TSuccess } from '../../renderer/utils/equalizerApi';

/**
 * Everything that crosses the boundary as a file the user chose or keeps.
 *
 * Four hundred and twenty-six lines of main.ts: importing a measurement, a
 * convolution or a whole chain, and exporting one back out. They belong
 * together because they are one shape — open a dialog the renderer never sees,
 * read or write a path it is never told, and reply with a description of what
 * happened rather than with the path itself.
 *
 * That is also why the dialogs are here rather than in the renderer. A renderer
 * that knew filesystem paths would be a renderer worth attacking; it asks for an
 * import and is told what was applied.
 */
export interface ITransferIpcDeps {
  state: IState;
  deviceProfileSettings: IDeviceProfileSettings;
  session: {
    configPath: string;
    activeAudioDeviceId: string;
    activeAudioDevice: IAudioDevice | undefined;
    hasActiveSessionOverride: boolean;
  };
  baselinePath: string;

  /**
   * The window, as a getter.
   *
   * A dialog needs a parent to be modal against, and the window does not exist
   * when these handlers are registered — same reason the other IPC modules take
   * it this way.
   */
  getMainWindow: () => BrowserWindow | null;

  presetDirForDevice: (deviceId: string) => string;
  activePresetDir: () => string;
  availableProfileNameForActiveDevice: (presetName: string) => string;
  attachPresetToActiveDevice: (presetName: string) => void;
  clearCurrentLayoutSettings: () => void;
  hydrateActiveConvolution: () => void;
  /** Bounds an imported reference so a bad measurement cannot silence output. */
  shieldReferenceBands: (filters: IFiltersMap) => IFiltersMap;
  applyingLayer: (layer: TApoLayer) => void;

  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
    action?: string,
  ) => void;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
}

export const registerTransferIpc = ({
  activePresetDir,
  applyingLayer,
  attachPresetToActiveDevice,
  availableProfileNameForActiveDevice,
  baselinePath,
  clearCurrentLayoutSettings,
  deviceProfileSettings,
  getMainWindow,
  handleError,
  handleUpdateHelper,
  hydrateActiveConvolution,
  presetDirForDevice,
  session,
  shieldReferenceBands,
  state,
}: ITransferIpcDeps) => {
  /**
   * Pick a file the user already has and apply it.
   *
   * The dialog lives here rather than in the renderer because the renderer never
   * gets to see a filesystem path — it asks for an import and is told what was
   * applied. Cancelling is a normal outcome, not an error: it replies with an
   * empty description and nothing changes.
   */
  const showImportDialog = async (
    title: string,
    filters: Electron.FileFilter[],
  ) => {
    // Held in a local: a getter cannot be narrowed by the check above it.
    const parent = getMainWindow();
    const result = parent
      ? await dialog.showOpenDialog(parent, {
          title,
          filters,
          properties: ['openFile'],
        })
      : await dialog.showOpenDialog({
          title,
          filters,
          properties: ['openFile'],
        });
    return result.canceled ? undefined : result.filePaths[0];
  };

  ipcMain.on(ChannelEnum.IMPORT_EQ_FILE, async (event) => {
    const channel = ChannelEnum.IMPORT_EQ_FILE;
    try {
      const sourcePath = await showImportDialog('Import EQ settings', [
        { name: 'EQ settings', extensions: ['txt', 'json'] },
        { name: 'All files', extensions: ['*'] },
      ]);
      if (!sourcePath) {
        const reply: TSuccess<string> = { result: '' };
        event.reply(channel, reply);
        return;
      }

      const imported = importEqFile(sourcePath);
      clearCurrentLayoutSettings();
      state.preAmp = imported.preAmp;
      state.filters = shieldReferenceBands(imported.filters);
      state.eqFormat = imported.eqFormat;
      state.graphicEq = imported.graphicEq;
      applyingLayer('eq');
      // These bands came from a file, not from a measured model.
      state.headset = undefined;
      state.headsetTarget = undefined;
      state.headsetSource = undefined;
      state.eqImport = undefined;
      // An imported EQ is a tuning, so the flat flag has to come off or the
      // bands would be parsed, stored, and then not written.
      state.isFlat = false;
      await handleUpdateHelper<string>(
        event,
        channel,
        imported.unsupported > 0
          ? `Imported ${Object.keys(imported.filters).length} bands from the ${imported.sourceLabel}. ${imported.unsupported} band(s) used a filter type ${PRODUCT_NAME} cannot edit and were skipped.`
          : `Imported ${Object.keys(imported.filters).length} bands from the ${imported.sourceLabel}.`,
        false,
        true,
      );
    } catch (error) {
      log.error('Failed to import EQ settings', error);
      handleError(
        event,
        channel,
        ErrorCode.IMPORT_ERROR,
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  ipcMain.on(ChannelEnum.IMPORT_EQ_TEXT, async (event, arg) => {
    const channel = ChannelEnum.IMPORT_EQ_TEXT;
    try {
      const text = arg?.[0];
      const label =
        typeof arg?.[1] === 'string' ? arg[1].trim().slice(0, 240) : '';
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Paste a Squiglink EQ export before importing it.');
      }
      if (Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024) {
        throw new Error('That EQ export is too large to import.');
      }

      const parsed = parseEqText(text);
      if (parsed.isEmpty) {
        throw new Error(
          'No Equalizer APO filters were found. Copy the exported ParametricEQ or GraphicEQ text from Squiglink.',
        );
      }

      clearCurrentLayoutSettings();
      state.preAmp = parsed.preAmp;
      // A preamp in the file is a decision, and automatic normalization would
      // quietly overrule it: the value lands in `preAmp`, the flush recomputes
      // from the chain, and what plays is FluidEQ's number rather than the one in
      // the export. Nothing said so. Whoever pasted a text that opens with
      // `Preamp: -19 dB` asked for -19, so automatic mode steps aside and the
      // import result says it did. Turning it back on is one click and now keeps
      // its value on the way out.
      if (parsed.hasPreAmp) {
        state.isAutoPreAmpOn = false;
      }
      state.filters = shieldReferenceBands(parsed.filters);
      state.eqFormat = parsed.eqFormat;
      state.graphicEq = parsed.graphicEq;
      state.isFlat = false;
      state.headset = undefined;
      state.headsetTarget = undefined;
      state.headsetSource = undefined;
      state.eqImport = {
        source: 'squiglink',
        sourceUrl: 'https://squig.link/',
        label: label || 'Squiglink export',
        eqFormat: parsed.eqFormat,
        filterCount: Object.keys(parsed.filters).length,
        text,
      };
      applyingLayer('eq');

      await handleUpdateHelper<string>(
        event,
        channel,
        [
          `Imported ${Object.keys(parsed.filters).length} bands from the Squiglink export.`,
          parsed.unsupported > 0
            ? `${parsed.unsupported} band(s) could not be edited in ${PRODUCT_NAME} and were skipped.`
            : '',
          // Said out loud, because a switch changing itself is worse than a
          // switch that did not, unless it tells you.
          parsed.hasPreAmp
            ? `Its ${parsed.preAmp} dB preamp was kept, so Auto normalize is off.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
        false,
        true,
      );
    } catch (error) {
      log.error('Failed to import Squiglink EQ text', error);
      handleError(
        event,
        channel,
        ErrorCode.IMPORT_ERROR,
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  ipcMain.on(ChannelEnum.IMPORT_CONVOLUTION_FILE, async (event) => {
    const channel = ChannelEnum.IMPORT_CONVOLUTION_FILE;
    try {
      const sourcePath = await showImportDialog('Import an impulse response', [
        { name: 'WAV impulse response', extensions: ['wav'] },
      ]);
      if (!sourcePath) {
        const reply: TSuccess<string> = { result: '' };
        event.reply(channel, reply);
        return;
      }

      if (!session.configPath) {
        session.configPath = await getConfigPath();
      }
      applyingLayer('convolution');
      state.convolution = importConvolutionFile(sourcePath, session.configPath);
      await handleUpdateHelper<string>(
        event,
        channel,
        `Applied ${state.convolution.name}.`,
        false,
        true,
      );
    } catch (error) {
      log.error('Failed to import a convolution file', error);
      handleError(
        event,
        channel,
        ErrorCode.IMPORT_ERROR,
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  /**
   * One output's whole chain, out to a file somebody can send to somebody else.
   *
   * The profile rather than the generated files — see `common/chainBundle` for
   * why moving the files themselves cannot work. The custom file travels
   * literally, because it is the only part of a chain FluidEQ does not generate
   * and so the only part that cannot be rebuilt at the other end.
   *
   * Named by `devicePattern` rather than by endpoint id, because that is what the
   * config panel has to offer: it reads the config off disk, and what a `Device:`
   * line carries is a GUID or a name, never the id Windows uses internally. Same
   * match the tree handler makes.
   */
  ipcMain.on(ChannelEnum.EXPORT_DEVICE_CHAIN, async (event, arg) => {
    const channel = ChannelEnum.EXPORT_DEVICE_CHAIN;
    const devicePattern = arg?.[0];
    if (typeof devicePattern !== 'string' || !devicePattern) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    try {
      const assignment = Object.values(deviceProfileSettings.assignments).find(
        (entry) =>
          (entry.deviceGuid || entry.deviceName).toLowerCase() ===
          devicePattern.toLowerCase(),
      );
      if (!assignment) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }

      const preset = fetchPreset(
        assignment.presetName,
        presetDirForDevice(assignment.deviceId),
      );
      let custom: string | undefined;
      try {
        if (!session.configPath) {
          session.configPath = await getConfigPath();
        }
        custom = fs.readFileSync(
          path.join(
            session.configPath,
            getCustomFileNameForDevice(assignment.deviceId),
          ),
          'utf8',
        );
      } catch {
        // An output that has never had one simply exports without it.
      }

      const bundle: IChainBundle = {
        version: 1,
        exportedFrom: assignment.deviceName,
        exportedAt: new Date().toISOString(),
        preset,
        custom,
      };

      const saveOptions = {
        title: 'Export this chain',
        defaultPath: chainBundleFileName(assignment.deviceName),
        filters: [
          {
            name: `${PRODUCT_NAME} chain`,
            extensions: [CHAIN_BUNDLE_EXTENSION],
          },
        ],
      };
      const parent = getMainWindow();
      const target = parent
        ? await dialog.showSaveDialog(parent, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (target.canceled || !target.filePath) {
        // Cancelling is a normal outcome rather than a failure.
        const reply: TSuccess<string> = { result: '' };
        event.reply(channel, reply);
        return;
      }

      fs.writeFileSync(target.filePath, serializeChainBundle(bundle), 'utf8');
      const reply: TSuccess<string> = {
        result: `Exported the chain for ${assignment.deviceName}.`,
      };
      event.reply(channel, reply);
    } catch (e) {
      handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
    }
  });

  /**
   * A chain from a file, onto the output being listened on.
   *
   * Onto the ACTIVE output deliberately, rather than onto whichever card was
   * clicked. Importing is the one direction that changes what is heard, and
   * "apply this to what I am listening to" is a sentence somebody can check
   * against their own ears at the moment they say it. Writing a chain onto an
   * output that is not playing is a change nobody can verify.
   *
   * The bundle's own `exportedFrom` is never consulted for this: a chain exported
   * from one person's headphones is meant to be usable on another's.
   */
  ipcMain.on(ChannelEnum.IMPORT_DEVICE_CHAIN, async (event) => {
    const channel = ChannelEnum.IMPORT_DEVICE_CHAIN;
    try {
      if (!session.activeAudioDeviceId) {
        handleError(
          event,
          channel,
          ErrorCode.FAILURE,
          'No output is active, so there is nothing to import onto.',
        );
        return;
      }

      const sourcePath = await showImportDialog('Import a chain', [
        { name: `${PRODUCT_NAME} chain`, extensions: [CHAIN_BUNDLE_EXTENSION] },
        { name: 'All files', extensions: ['*'] },
      ]);
      if (!sourcePath) {
        const reply: TSuccess<IChainImport> = {
          result: { note: '', isCustomSkipped: false },
        };
        event.reply(channel, reply);
        return;
      }

      const bundle = parseChainBundle(
        JSON.parse(fs.readFileSync(sourcePath, 'utf8')),
      );
      if (!bundle) {
        handleError(
          event,
          channel,
          ErrorCode.IMPORT_ERROR,
          `That file is not a ${PRODUCT_NAME} chain.`,
        );
        return;
      }

      // Named for where it is going rather than where it came from, because the
      // profile list is indexed by that and it is what the user will look for.
      const name = availableProfileNameForActiveDevice(
        session.activeAudioDevice?.name || session.activeAudioDeviceId,
      );
      savePreset(name, bundle.preset, activePresetDir());
      savePresetBaseline(name, bundle.preset, baselinePath);
      attachPresetToActiveDevice(name);

      // The one part of a bundle that is not a tuning but a program. Everything
      // else here has been through the preset schema; this is text on its way to
      // a file Equalizer APO includes, so it is asked first — see
      // `isSafeImportedCustomBlock` for what is refused and why.
      let isCustomSkipped = false;
      if (bundle.custom !== undefined) {
        if (isSafeImportedCustomBlock(bundle.custom)) {
          if (!session.configPath) {
            session.configPath = await getConfigPath();
          }
          // Over the top of this output's own custom file, which is the only part
          // of an import that destroys something written by hand. It is also the
          // only honest reading of "import this chain": leaving the old one would
          // apply somebody else's chain plus your own additions, which is a third
          // thing neither of you has ever heard.
          fs.writeFileSync(
            path.join(
              session.configPath,
              getCustomFileNameForDevice(session.activeAudioDeviceId),
            ),
            bundle.custom,
            'utf8',
          );
        } else {
          // And a refused block does NOT clear the file it was going to replace.
          // Overwriting is what an accepted import earns; doing it for a refused
          // one would hand a stranger a way to wipe somebody's hand-written file
          // by sending a bundle that was never going to be applied. The chain is
          // a hybrid afterwards — theirs, plus your own last line — and the note
          // below says so, which is better than silently deleting your work.
          isCustomSkipped = true;
        }
      }

      // Field by field, like loading a profile, because `state` is the live one
      // rather than a value to swap: every reader here holds the same object.
      clearCurrentLayoutSettings();
      state.preAmp = bundle.preset.preAmp;
      state.filters = bundle.preset.filters;
      state.eqFormat = bundle.preset.eqFormat;
      state.graphicEq = bundle.preset.graphicEq;
      state.convolution = bundle.preset.convolution;
      hydrateActiveConvolution();
      state.isFlat = bundle.preset.isFlat;
      state.voicing = bundle.preset.voicing;
      state.driver = bundle.preset.driver;
      state.smartEq = bundle.preset.smartEq;
      state.headset = bundle.preset.headset;
      state.headsetTarget = bundle.preset.headsetTarget;
      state.headsetSource = bundle.preset.headsetSource;
      state.headsetSignature = bundle.preset.headsetSignature;
      state.eqImport = bundle.preset.eqImport;
      /*
       * The headphone layer, which this list forgot when the layer was added.
       *
       * Three other sites copy a preset onto the live state and all three carry
       * it; only this one did not, so importing a chain silently dropped the
       * correction it was carrying. Worse than dropped: `headsetSignature` two
       * lines up WAS copied, so the layers strip then described a correction
       * against bands that had never produced it.
       *
       * And it did not stop at this run. `handleUpdateHelper` re-saves the
       * profile from `getCurrentPreset()`, which reads the live state — so the
       * correct file this import had just written to disk was immediately
       * overwritten from a state still holding the PREVIOUS output's correction.
       * The imported profile was destroyed by the act of importing it.
       *
       * The comment above this block names the invariant it broke, and the one on
       * `getCurrentPreset` says a miss of exactly this kind "was missed for
       * months". Both were right and neither was enough; a test is, so there is
       * one now.
       */
      state.headphone = bundle.preset.headphone;
      state.bypassed = bundle.preset.bypassed;

      await handleUpdateHelper<IChainImport>(
        event,
        channel,
        {
          note: `Imported the chain${
            bundle.exportedFrom ? ` from ${bundle.exportedFrom}` : ''
          }.`,
          isCustomSkipped,
        },
        true,
      );
    } catch (e) {
      handleError(
        event,
        channel,
        ErrorCode.IMPORT_ERROR,
        e instanceof Error ? e.message : undefined,
      );
    }
  });
};
