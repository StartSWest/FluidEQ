/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import { IDeviceProfileAssignment } from 'common/constants';
import { isRestrictedPresetName } from 'common/utils';
import { useAquaContext } from './utils/AquaContext';
import TextInput from './widgets/TextInput';
import Button from './widgets/Button';
import List, { IOptionEntry } from './widgets/List';
import PresetListItem from './components/PresetListItem';
import SidebarSection from './components/SidebarSection';
import ProfileActionIcon from './icons/ProfileActionIcon';
import { formatPresetName } from './utils/utils';
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
  savePreset: (presetName: string) => Promise<void>;
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
  } = useAquaContext();

  const [presetName, setPresetName] = useState<string>('');
  const [newPresetNameError, setNewPresetNameError] = useState<string>('');
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
    // Nothing is scoped to an output we have not identified yet. Showing the
    // whole catalogue here made the list flash every profile in the app for a
    // frame before collapsing to the one that belongs to this device.
    if (!hasResolvedOutput) {
      return [];
    }
    if (!assignedPresetForOutput) {
      // No endpoint at all (enumeration unavailable or refused) is the one case
      // where the unscoped catalogue is still the most useful thing to show —
      // otherwise the profile list would be permanently empty.
      return activeDeviceId ? [] : presetNames;
    }
    // The device assignment is authoritative while the file-list IPC call is
    // catching up during startup. This prevents the profile card from being
    // empty until the user creates another profile.
    return [assignedPresetForOutput];
  }, [activeDeviceId, assignedPresetForOutput, hasResolvedOutput, presetNames]);

  useEffect(() => {
    setPresetName((current) =>
      visiblePresetNames.includes(current) ? current : '',
    );
  }, [visiblePresetNames]);

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
    setPresetName('');
    setNewPresetNameError('');
  }, []);

  // Creating a new preset
  const handleCreateOrSavePreset = useCallback(async () => {
    // Do not create or save a preset if there is no name or if there is an error present
    if (!presetName || newPresetNameError) {
      return;
    }

    try {
      await savePreset(presetName);

      // If we are creating a new preset and not just updating an existing one, update the list of preset names
      if (!isExistingPresetSelected) {
        dispatchPresetNames({
          type: PresetActionEnum.CREATE,
          presetName,
        });
      }
      await refreshOutputProfiles();
      // Keep the newly saved profile selected while the output-scoped list
      // catches up with the assignment written by the main process.
      setPresetName(presetName);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [
    isExistingPresetSelected,
    newPresetNameError,
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

  const validatePresetNew = useCallback(
    (newName: string) => {
      /**
       * For a not case sensitive file system (apple is equal to ApPlE), we want to prevent users from creating a new preset
       * that has the same characters that differ only in case. However, we want to allow users to specify an exact duplicate
       * (where the characters and the case both match) so they can overwrite their existing presets.
       */
      if (
        !isCaseSensitiveFs &&
        presetNames.some(
          (existingName) =>
            newName.toLocaleLowerCase() === existingName.toLocaleLowerCase() &&
            existingName !== newName,
        )
      ) {
        return PresetErrorEnum.DUPLICATE;
      }
      return validatePresetName(newName);
    },
    [isCaseSensitiveFs, presetNames, validatePresetName],
  );

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

  const handleChangeNewPresetName = (newValue: string) => {
    setPresetName(newValue);

    // Validate new preset name and update error message accordingly
    const msg = validatePresetNew(newValue);
    setNewPresetNameError(msg);
  };

  // Changing the selected preset in the UI
  // Restore targets the profile attached to this output, falling back to the
  // one typed in the name box when nothing is attached yet.
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
            handleRename={handleRenameExistingPresetName(n)}
            handleDelete={handleDeletePreset(n)}
            isDisabled={isBlockingError}
            validate={validatePresetRename(n)}
          />
        ),
      };
    });
  }, [
    validatePresetRename,
    isBlockingError,
    handleDeletePreset,
    handleRenameExistingPresetName,
    visiblePresetNames,
  ]);

  return (
    <SidebarSection
      eyebrow="YOUR SOUND"
      title="Named profiles"
      summary={
        <List
          name="preset"
          options={options}
          itemClassName="preset-list-item"
          value={presetName}
          handleChange={handleChangeSelectedPreset}
          isDisabled={isBlockingError}
          emptyOptionsPlaceholder={(() => {
            if (!hasResolvedOutput) {
              return 'Detecting your output…';
            }
            return activeDeviceId
              ? 'No profile attached to this output.'
              : 'No profiles yet. Create your first sound.';
          })()}
        />
      }
    >
      <div className="presets-bar">
        <p className="presets-bar__lede">
          Save unlimited tunings and attach any one to an output.
        </p>
        <div className="profile-compose">
          <div className="preset-name">Profile name</div>
          <TextInput
            value={presetName}
            ariaLabel="Preset Name"
            isDisabled={isBlockingError}
            errorMessage={newPresetNameError}
            handleChange={handleChangeNewPresetName}
            handleSubmit={handleCreateOrSavePreset}
            formatInput={formatPresetName}
          />
        </div>
        <div className="profile-actions">
          {/* Starting a new profile is its own action. Without it the only way
            to create one was to clear the name box by hand, and it was never
            obvious whether Save would make a new profile or overwrite the
            attached one — which is a bad thing to be unsure about. */}
          <Button
            ariaLabel="Start a new profile from the current EQ"
            className="small subtle profile-actions__new"
            isDisabled={isBlockingError}
            handleChange={handleStartNewProfile}
          >
            <ProfileActionIcon action="new" />
            New profile
          </Button>
          <Button
            // Stable: the control's identity does not change, only what it will
            // do to the name currently in the box. Assistive tech should not see
            // this button rename itself as the user types.
            ariaLabel="Save settings to preset"
            className="small profile-actions__save"
            isDisabled={isBlockingError || !presetName || !!newPresetNameError}
            handleChange={handleCreateOrSavePreset}
          >
            <ProfileActionIcon action="save" />
            {isExistingPresetSelected ? 'Update' : 'Save as new'}
          </Button>
          {/* Every edit auto-saves into the attached profile, so this is the way
            back to the version the user deliberately kept. */}
          <Button
            ariaLabel="Restore the last manually saved version of this profile"
            className="small subtle profile-actions__restore"
            isDisabled={isBlockingError || isRestoring || !canRestoreBaseline}
            handleChange={handleRestoreBaseline}
          >
            <ProfileActionIcon action="restore" />
            {isRestoring ? 'Restoring…' : 'Restore'}
          </Button>
        </div>
      </div>
    </SidebarSection>
  );
};

export default PresetsBar;
