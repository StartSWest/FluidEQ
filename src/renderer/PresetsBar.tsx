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

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import './styles/PresetsBar.scss';
import { ErrorDescription } from 'common/errors';
import {
  AUTOMATIC_PRESET_PREFIX,
  IDeviceProfileAssignment,
} from 'common/constants';
import { isRestrictedPresetName } from 'common/utils';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import Button from './widgets/Button';
import List, { IOptionEntry } from './widgets/List';
import PresetListItem from './components/PresetListItem';
import SidebarSection from './components/SidebarSection';
import ProfileActionIcon from './icons/ProfileActionIcon';
import {
  getAudioDevices,
  getDeviceProfileSettings,
  getPresetBaselineNames,
  restorePresetBaseline,
} from './utils/equalizerApi';

export enum PresetErrorEnum {
  EMPTY = 'Preset name cannot be empty.',
  RESTRICTED = 'Invalid preset name, please use another.',
  DUPLICATE = 'Duplicate name found, please use another.',
}

export enum PresetActionEnum {
  INIT,
  CREATE,
  DELETE,
  RENAME,
}

export type PresetAction =
  | { type: PresetActionEnum.INIT; presetNames: string[] }
  | { type: PresetActionEnum.CREATE; presetName: string }
  | { type: PresetActionEnum.DELETE; presetName: string }
  | { type: PresetActionEnum.RENAME; oldName: string; newName: string };

type IPresetReducer = (presetNames: string[], action: PresetAction) => string[];

const presetReducer: IPresetReducer = (
  presetNames: string[],
  action: PresetAction,
) => {
  switch (action.type) {
    case PresetActionEnum.INIT:
      return action.presetNames.sort();
    case PresetActionEnum.CREATE:
      return [...presetNames, action.presetName].sort();
    case PresetActionEnum.DELETE:
      return presetNames.filter((name) => name !== action.presetName);
    case PresetActionEnum.RENAME:
      return presetNames.map((name) =>
        name === action.oldName ? action.newName : name,
      );
    default:
      // This throw does not actually do anything because
      // we are in a reducer
      throw new Error('Unhandled action type should not occur');
  }
};

interface IPresetsBarProps {
  fetchPresets: () => Promise<string[]>;
  loadPreset: (presetName: string) => Promise<void>;
  /** Resolves with the name actually used, which may differ from the one asked for. */
  savePreset: (presetName: string) => Promise<string>;
  renamePreset: (oldName: string, newName: string) => Promise<void>;
  deletePreset: (presetName: string) => Promise<void>;
}

const PresetsBar = ({
  fetchPresets,
  loadPreset,
  savePreset,
  renamePreset,
  deletePreset,
}: IPresetsBarProps) => {
  const {
    isBlockingError,
    isCaseSensitiveFs,
    performHealthCheck,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();

  const [presetName, setPresetName] = useState<string>('');
  const [presetNames, dispatchPresetNames] = useReducer(presetReducer, []);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  // Until the endpoint query has come back at least once we do not know which
  // profiles belong here, and showing the wrong ones for a frame is worse than
  // showing none.
  const [hasResolvedOutput, setHasResolvedOutput] = useState(false);
  const [deviceAssignments, setDeviceAssignments] = useState<
    Record<string, IDeviceProfileAssignment>
  >({});
  // Profiles that have a hand-saved copy sitting behind the auto-saved one.
  const [baselineNames, setBaselineNames] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchPresetNames = useCallback(async () => {
    try {
      const result = await fetchPresets();
      dispatchPresetNames({
        type: PresetActionEnum.INIT,
        presetNames: result,
      });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [fetchPresets, setGlobalError]);

  const refreshOutputProfiles = useCallback(async () => {
    try {
      const [devices, settings, baselines] = await Promise.all([
        getAudioDevices(),
        getDeviceProfileSettings(),
        getPresetBaselineNames(),
      ]);
      setActiveDeviceId(devices.find((device) => device.isDefault)?.id || '');
      setDeviceAssignments(settings.assignments);
      setBaselineNames(baselines);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      // Even a failed lookup counts as resolved: the list must not sit on a
      // spinner forever because the endpoint query broke.
      setHasResolvedOutput(true);
    }
  }, [setGlobalError]);

  useEffect(() => {
    refreshOutputProfiles();
    const handleOutputChanged = () => {
      refreshOutputProfiles();
      // The initial IPC request can race the main-process startup. Retry the
      // preset catalogue after the active endpoint has been discovered.
      fetchPresetNames();
    };
    window.addEventListener('fluideq-output-changed', handleOutputChanged);
    return () =>
      window.removeEventListener('fluideq-output-changed', handleOutputChanged);
  }, [fetchPresetNames, refreshOutputProfiles]);

  const assignedPresetForOutput = activeDeviceId
    ? deviceAssignments[activeDeviceId]?.presetName || ''
    : '';
  const visiblePresetNames = useMemo(() => {
    // Nothing is shown until we know which output is live. Rendering during
    // that first frame made the list flash its contents and then rearrange,
    // which is worse than a moment of "Detecting your output…".
    if (!hasResolvedOutput) {
      return [];
    }
    // Automatic profiles are FluidEQ's own bookkeeping — a hashed filename the
    // user never chose and cannot meaningfully rename or delete. Listing one as
    // if it were a saved profile just leaks an implementation detail.
    const named = presetNames.filter(
      (name) => !name.startsWith(AUTOMATIC_PRESET_PREFIX),
    );
    // Every named profile, not only the attached one. Scoping the list to the
    // current output made it a one-row readout of something the card already
    // states, and left no way to switch to another profile or even see that
    // the one you just created exists.
    if (
      assignedPresetForOutput &&
      !assignedPresetForOutput.startsWith(AUTOMATIC_PRESET_PREFIX) &&
      !named.includes(assignedPresetForOutput)
    ) {
      // The device assignment is authoritative while the file-list IPC call is
      // still catching up during startup.
      return [...named, assignedPresetForOutput].sort();
    }
    return named;
  }, [assignedPresetForOutput, hasResolvedOutput, presetNames]);

  // Follow the output: switching device shows the profile that device plays
  // through. Keyed on the assignment alone, so a background refresh can never
  // overwrite a name the user is in the middle of typing.
  useEffect(() => {
    if (
      assignedPresetForOutput &&
      !assignedPresetForOutput.startsWith(AUTOMATIC_PRESET_PREFIX)
    ) {
      setPresetName(assignedPresetForOutput);
    }
  }, [assignedPresetForOutput]);

  const isExistingPresetSelected = useMemo(
    () =>
      presetNames.some((n) => n === presetName) ||
      assignedPresetForOutput === presetName,
    [assignedPresetForOutput, presetName, presetNames],
  );

  // Fetch default presets and custom presets from storage
  useEffect(() => {
    fetchPresetNames();
    window.addEventListener('fluideq-presets-changed', fetchPresetNames);
    return () =>
      window.removeEventListener('fluideq-presets-changed', fetchPresetNames);
  }, [fetchPresetNames]);

  /**
   * Clear the name so the next save creates rather than overwrites.
   *
   * Deliberately does not touch the EQ: "new profile" here means a new place to
   * put the sound you have, which is what you almost always want after tuning
   * something you like. Wiping the bands as well would throw that away.
   */
  const handleStartNewProfile = useCallback(async () => {
    // Numbered against the whole catalogue, not the visible list. The list is
    // scoped to this output, so counting only what is on screen would hand out
    // "Untitled profile 1" again for a name that already exists elsewhere and
    // silently overwrite it.
    const taken = new Set(presetNames);
    // Named in the user's own language, so the profiles they end up with read
    // like something the app made for them rather than a leaked English default.
    const prefix = t('profiles.untitled');
    let index = 1;
    while (taken.has(`${prefix} ${index}`)) {
      index += 1;
    }
    const name = `${prefix} ${index}`;

    try {
      // Created for real, not just typed into the box. A button called "New
      // profile" that only clears a text field leaves you unsure whether you
      // have one until you press something else.
      // Main has the last word on the name: it will not write over a profile
      // another output owns, so what comes back may be numbered differently.
      const saved = (await savePreset(name)) || name;
      dispatchPresetNames({ type: PresetActionEnum.CREATE, presetName: saved });
      await refreshOutputProfiles();
      setPresetName(saved);
      performHealthCheck();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [
    presetNames,
    savePreset,
    refreshOutputProfiles,
    performHealthCheck,
    setGlobalError,
    t,
  ]);

  // Creating a new preset
  const handleCreateOrSavePreset = useCallback(async () => {
    // Do not create or save a preset if there is no name or if there is an error present
    if (!presetName) {
      return;
    }

    try {
      const saved = (await savePreset(presetName)) || presetName;

      // A name main had to change is a new profile even if the one typed
      // already existed — it belonged to a different output.
      if (!isExistingPresetSelected || saved !== presetName) {
        dispatchPresetNames({
          type: PresetActionEnum.CREATE,
          presetName: saved,
        });
      }
      await refreshOutputProfiles();
      // Keep the newly saved profile selected while the list catches up with
      // the assignment written by the main process.
      setPresetName(saved);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [
    isExistingPresetSelected,
    presetName,
    refreshOutputProfiles,
    savePreset,
    setGlobalError,
  ]);

  // Loading audio settings from an existing preset
  const handleLoadPreset = async (presetToLoad = presetName) => {
    if (presetToLoad && visiblePresetNames.includes(presetToLoad)) {
      try {
        await loadPreset(presetToLoad);
        await refreshOutputProfiles();
        performHealthCheck();
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    }
  };

  // Validating a new preset name
  const validatePresetName = useCallback((newValue: string) => {
    if (isRestrictedPresetName(newValue)) {
      return PresetErrorEnum.RESTRICTED;
    }

    return '';
  }, []);

  // Validating a preset rename
  const validatePresetRename = useCallback(
    (oldName: string) => (newName: string) => {
      if (!newName) {
        return PresetErrorEnum.EMPTY;
      }

      /**
       *  Should cover the following cases for duplicate detection and case sensitivity:
       *   - rename "apple" to "Apple" -> Case Insensitive: allowed, Case Sensitive: allowed
       *   - rename "banana" to "Apple" when another "apple" preset exists -> Case Insensitive: DUPLICATE, Case Sensitive: allowed
       */
      if (
        isCaseSensitiveFs
          ? presetNames.some(
              (existingName) =>
                existingName !== oldName && existingName === newName,
            )
          : presetNames.some(
              (existingName) =>
                existingName !== oldName &&
                existingName.toLocaleLowerCase() ===
                  newName.toLocaleLowerCase(),
            )
      ) {
        return PresetErrorEnum.DUPLICATE;
      }

      return validatePresetName(newName);
    },
    [isCaseSensitiveFs, presetNames, validatePresetName],
  );

  // Restore targets the profile attached to this output, falling back to the
  // selected one when nothing is attached yet.
  const restoreTarget = assignedPresetForOutput || presetName;
  const canRestoreBaseline =
    !!restoreTarget && baselineNames.includes(restoreTarget);

  const handleRestoreBaseline = async () => {
    if (!canRestoreBaseline) {
      return;
    }
    setIsRestoring(true);
    try {
      await restorePresetBaseline(restoreTarget);
      await refreshOutputProfiles();
      performHealthCheck();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleChangeSelectedPreset = (newValue: string) => {
    setPresetName(newValue);
    // Selecting a named profile also attaches it to the active output.
    handleLoadPreset(newValue);
  };

  // Deleting a preset
  const handleDeletePreset = useCallback(
    (deletedValue: string) => async () => {
      try {
        await deletePreset(deletedValue);
        dispatchPresetNames({
          type: PresetActionEnum.DELETE,
          presetName: deletedValue,
        });
        await refreshOutputProfiles();

        // Deselect preset name info since the preset no longer exists
        setPresetName('');
      } catch (e) {
        // continue to run, the worst case is that the file still exists and that's all.
      }
    },
    [deletePreset, refreshOutputProfiles],
  );

  // Renaming an existing preset
  const handleRenameExistingPresetName = useCallback(
    (oldName: string) => async (newName: string) => {
      try {
        await renamePreset(oldName, newName);
        await refreshOutputProfiles();
        dispatchPresetNames({
          type: PresetActionEnum.RENAME,
          oldName,
          newName,
        });

        // Update preset name to reflect updated value
        setPresetName(newName);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [refreshOutputProfiles, renamePreset, setGlobalError],
  );

  const options: IOptionEntry[] = useMemo(() => {
    return visiblePresetNames.map((n) => {
      return {
        value: n,
        label: n,
        display: (
          <PresetListItem
            value={n}
            isAttached={n === assignedPresetForOutput}
            handleRename={handleRenameExistingPresetName(n)}
            handleDelete={handleDeletePreset(n)}
            isDisabled={isBlockingError}
            validate={validatePresetRename(n)}
          />
        ),
      };
    });
  }, [
    assignedPresetForOutput,
    validatePresetRename,
    isBlockingError,
    handleDeletePreset,
    handleRenameExistingPresetName,
    visiblePresetNames,
  ]);

  return (
    <SidebarSection
      eyebrow={t('profiles.eyebrow')}
      title={t('profiles.title')}
      summary={
        <List
          name="preset"
          className="profile-list"
          options={options}
          itemClassName="preset-list-item"
          value={presetName}
          handleChange={handleChangeSelectedPreset}
          isDisabled={isBlockingError}
          emptyOptionsPlaceholder={
            hasResolvedOutput ? t('profiles.empty') : t('profiles.detecting')
          }
        />
      }
    >
      <div className="presets-bar">
        {/* No name box. Naming happens where the name is: the edit control on
            the profile row itself. A second place to type it was one more
            thing to keep in sync with the list, and it made Save ambiguous —
            you could never tell whether it would create or overwrite. */}
        <div className="profile-actions">
          {/* Starting a new profile is its own action. Without it the only way
            to create one was to clear the name box by hand, and it was never
            obvious whether Save would make a new profile or overwrite the
            attached one — which is a bad thing to be unsure about. */}
          <Button
            ariaLabel={t('profiles.newAria')}
            className="small subtle profile-actions__new"
            isDisabled={isBlockingError}
            handleChange={handleStartNewProfile}
          >
            <ProfileActionIcon action="new" />
            {t('profiles.new')}
          </Button>
          {/* Always an update now, never a create — New profile is the only way
              to make one, so this can say exactly what it does. */}
          <Button
            ariaLabel={t('profiles.saveAria')}
            className="small profile-actions__save"
            isDisabled={isBlockingError || !presetName}
            handleChange={handleCreateOrSavePreset}
          >
            <ProfileActionIcon action="save" />
            {t('profiles.update')}
          </Button>
          {/* Every edit auto-saves into the attached profile, so this is the way
            back to the version the user deliberately kept. */}
          <Button
            ariaLabel={t('profiles.restoreAria')}
            className="small subtle profile-actions__restore"
            isDisabled={isBlockingError || isRestoring || !canRestoreBaseline}
            handleChange={handleRestoreBaseline}
          >
            <ProfileActionIcon action="restore" />
            {isRestoring ? t('profiles.restoring') : t('profiles.restore')}
          </Button>
        </div>
      </div>
    </SidebarSection>
  );
};

export default PresetsBar;
