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

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import './styles/PresetsBar.scss';
import { ErrorDescription } from 'common/errors';
import {
  AUTOMATIC_PRESET_PREFIX,
  IDeviceProfileAssignment,
} from 'common/constants';
import { isRestrictedPresetName } from 'common/utils';
import type { TranslationKey } from 'common/i18n/en';
import { keepSongSound, yieldSongSound } from './audio/songSoundSession';
import { useFluidEqShell } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { readOutputEditor } from './utils/outputEditor';
import useMainOutputEditor from './utils/useMainOutputEditor';
import Button from './widgets/Button';
import List, { IOptionEntry } from './widgets/List';
import PresetListItem from './components/PresetListItem';
import ProfileActionIcon from './icons/ProfileActionIcon';
import {
  getDeviceProfileSettings,
  getPresetBaselineNames,
  restorePresetBaseline,
} from './utils/equalizerApi';

/**
 * Why a rename is refused, as the key of the line the name field shows.
 *
 * These were English sentences, shown as written in every language while their
 * translations sat unused in the dictionaries. The field prints whatever
 * `validate` returns, so the sentence is translated here, before it gets there.
 */
export const PRESET_NAME_ERRORS = {
  EMPTY: 'profiles.error.empty',
  RESTRICTED: 'profiles.error.restricted',
  DUPLICATE: 'profiles.error.duplicate',
} as const satisfies Record<string, TranslationKey>;

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
  fetchPresets: (deviceId?: string) => Promise<string[]>;
  loadPreset: (presetName: string, deviceId?: string) => Promise<void>;
  /** Overwrites the named profile. Never creates a second one beside it. */
  savePreset: (presetName: string, deviceId?: string) => Promise<void>;
  /** Resolves with the name actually used, which is numbered when taken. */
  createPreset: (requestedName: string, deviceId?: string) => Promise<string>;
  renamePreset: (
    oldName: string,
    newName: string,
    deviceId?: string,
  ) => Promise<void>;
  deletePreset: (presetName: string, deviceId?: string) => Promise<void>;
}

// This list lives under the MAIN selector even when another output is being tuned.
const profileOutputKey = () => readOutputEditor().main?.id ?? '';

const PresetsBar = ({
  fetchPresets,
  loadPreset,
  savePreset,
  createPreset,
  renamePreset,
  deletePreset,
}: IPresetsBarProps) => {
  /**
   * `refreshState`, never `performHealthCheck`.
   *
   * Both re-read the whole state; the health check also raises the app's
   * loading flag, and the loading flag is the start-up screen — the workspace,
   * the graph and every band are replaced by a spinner and then built again.
   * Selecting a profile that way made the EQ vanish and come back rather than
   * move to its new values, which is the one thing switching profile should
   * look like. Nothing here is a start-up: the window is already up and the
   * bands only need new numbers.
   */
  const { isBlockingError, isCaseSensitiveFs, refreshState, setGlobalError } =
    useFluidEqShell();
  const { t } = useTranslation();
  const enterMainEditor = useMainOutputEditor();

  const [presetName, setPresetName] = useState<string>('');
  const [presetNames, dispatchPresetNames] = useReducer(presetReducer, []);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const resolvedOutput = useRef<string | undefined>(undefined);
  const catalogueRequest = useRef(0);
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

  const refreshOutputProfiles = useCallback(async () => {
    const { main } = readOutputEditor();
    catalogueRequest.current += 1;
    const request = catalogueRequest.current;
    if (!main) {
      return;
    }
    const outputKey = main.id;
    if (resolvedOutput.current !== outputKey) {
      setHasResolvedOutput(false);
      setPresetName('');
      setActiveDeviceId('');
      setDeviceAssignments({});
      setBaselineNames([]);
      dispatchPresetNames({ type: PresetActionEnum.INIT, presetNames: [] });
    }
    const isCurrent = () =>
      catalogueRequest.current === request && profileOutputKey() === outputKey;
    try {
      // Publish one output's catalogue and assignment together. Independent
      // replies briefly put the old output's names under the new main selector.
      const [names, settings, baselines] = await Promise.all([
        fetchPresets(outputKey),
        getDeviceProfileSettings(),
        getPresetBaselineNames(outputKey),
      ]);
      if (!isCurrent()) {
        return;
      }
      dispatchPresetNames({ type: PresetActionEnum.INIT, presetNames: names });
      setActiveDeviceId(outputKey);
      setDeviceAssignments(settings.assignments);
      setBaselineNames(baselines);
    } catch (e) {
      if (isCurrent()) {
        setGlobalError(e as ErrorDescription);
      }
    } finally {
      // A failed current lookup reports its error rather than leaving a spinner.
      if (isCurrent()) {
        resolvedOutput.current = outputKey;
        setHasResolvedOutput(true);
      }
    }
  }, [fetchPresets, setGlobalError]);

  useEffect(() => {
    refreshOutputProfiles();
    window.addEventListener('fluideq-output-changed', refreshOutputProfiles);
    window.addEventListener('fluideq-editor-changed', refreshOutputProfiles);
    window.addEventListener('fluideq-presets-changed', refreshOutputProfiles);
    return () => {
      catalogueRequest.current += 1;
      window.removeEventListener(
        'fluideq-output-changed',
        refreshOutputProfiles,
      );
      window.removeEventListener(
        'fluideq-editor-changed',
        refreshOutputProfiles,
      );
      window.removeEventListener(
        'fluideq-presets-changed',
        refreshOutputProfiles,
      );
    };
  }, [refreshOutputProfiles]);

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
  }, [activeDeviceId, assignedPresetForOutput]);

  const isExistingPresetSelected = useMemo(
    () =>
      presetNames.some((n) => n === presetName) ||
      assignedPresetForOutput === presetName,
    [assignedPresetForOutput, presetName, presetNames],
  );

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
      // Main has the last word on the name: it numbers it against the folder on
      // disk, so what comes back may differ from what was asked for. What
      // plays is what the profile is made of, a song's own sound included,
      // so that sound stays rather than being handed back at the song's end.
      await enterMainEditor(activeDeviceId);
      await keepSongSound();
      const saved = (await createPreset(name, activeDeviceId)) || name;
      // The write can finish after Windows selects another main. Its result
      // must never become that new output's selected profile.
      if (profileOutputKey() !== activeDeviceId) {
        return;
      }
      dispatchPresetNames({ type: PresetActionEnum.CREATE, presetName: saved });
      await refreshOutputProfiles();
      if (profileOutputKey() !== activeDeviceId) {
        return;
      }
      setPresetName(saved);
      await refreshState();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [
    activeDeviceId,
    enterMainEditor,
    presetNames,
    createPreset,
    refreshOutputProfiles,
    refreshState,
    setGlobalError,
    t,
  ]);

  /**
   * Update: the sound on screen becomes what the selected profile holds.
   *
   * Only ever writes the profile that is selected. It used to accept a
   * different name back from the save and follow it, which is how pressing
   * Update left a second profile called "… 2" attached to the output.
   */
  const handleSavePreset = useCallback(async () => {
    // Do not save a preset if there is no name or if there is an error present
    if (!presetName) {
      return;
    }

    try {
      // Saved as heard, a song's own sound included, which then stays.
      await enterMainEditor(activeDeviceId);
      await keepSongSound();
      await savePreset(presetName, activeDeviceId);
      if (profileOutputKey() !== activeDeviceId) {
        return;
      }

      // The catalogue can be a moment behind the folder — a profile created on
      // another surface is still one of this output's, and Update is where the
      // list first hears about it.
      if (!isExistingPresetSelected) {
        dispatchPresetNames({
          type: PresetActionEnum.CREATE,
          presetName,
        });
      }
      await refreshOutputProfiles();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [
    activeDeviceId,
    enterMainEditor,
    isExistingPresetSelected,
    presetName,
    refreshOutputProfiles,
    savePreset,
    setGlobalError,
  ]);

  // Loading audio settings from an existing preset.
  //
  // Memoised because deleting a profile calls it to attach whichever one the
  // selection lands on, and an identity that changed every render would rebuild
  // that handler — and every row's delete button with it — on each keystroke.
  const handleLoadPreset = useCallback(
    async (presetToLoad = presetName) => {
      if (presetToLoad && visiblePresetNames.includes(presetToLoad)) {
        try {
          // A song's own sound comes off first, so the profile lands on the
          // listener's and nothing hands the song's back over it later.
          await enterMainEditor(activeDeviceId);
          await yieldSongSound();
          await loadPreset(presetToLoad, activeDeviceId);
          await refreshOutputProfiles();
          await refreshState();
        } catch (e) {
          setGlobalError(e as ErrorDescription);
        }
      }
    },
    [
      activeDeviceId,
      enterMainEditor,
      presetName,
      visiblePresetNames,
      loadPreset,
      refreshOutputProfiles,
      refreshState,
      setGlobalError,
    ],
  );

  // Validating a new preset name
  const validatePresetName = useCallback(
    (newValue: string) => {
      if (isRestrictedPresetName(newValue)) {
        return t(PRESET_NAME_ERRORS.RESTRICTED);
      }

      return '';
    },
    [t],
  );

  // Validating a preset rename
  const validatePresetRename = useCallback(
    (oldName: string) => (newName: string) => {
      if (!newName) {
        return t(PRESET_NAME_ERRORS.EMPTY);
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
        return t(PRESET_NAME_ERRORS.DUPLICATE);
      }

      return validatePresetName(newName);
    },
    [isCaseSensitiveFs, presetNames, t, validatePresetName],
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
      await enterMainEditor(activeDeviceId);
      await yieldSongSound();
      await restorePresetBaseline(restoreTarget, activeDeviceId);
      await refreshOutputProfiles();
      await refreshState();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleChangeSelectedPreset = (newValue: string) => {
    if (profileOutputKey() !== activeDeviceId) {
      return;
    }
    setPresetName(newValue);
    // Selecting a named profile also attaches it to the active output.
    handleLoadPreset(newValue);
  };

  // Deleting a preset
  const handleDeletePreset = useCallback(
    (deletedValue: string) => async () => {
      // Worked out before the delete, while the list still holds it: which
      // profile the selection should land on is a question about where this one
      // sat among the others, and afterwards there is no answer to read.
      const wasSelected = deletedValue === presetName;
      const remaining = presetNames.filter((n) => n !== deletedValue);
      const deletedAt = presetNames.indexOf(deletedValue);
      // The one that moves up into the gap, or the one above if this was last.
      // Landing on nothing would leave the output with no profile selected
      // while it is still playing one.
      const successor = remaining[deletedAt] ?? remaining[deletedAt - 1];

      try {
        await enterMainEditor(activeDeviceId);
        await deletePreset(deletedValue, activeDeviceId);
        if (profileOutputKey() !== activeDeviceId) {
          return;
        }
        dispatchPresetNames({
          type: PresetActionEnum.DELETE,
          presetName: deletedValue,
        });
        await refreshOutputProfiles();
        if (profileOutputKey() !== activeDeviceId) {
          return;
        }

        // Only the selection that just stopped existing is disturbed. Clearing
        // it unconditionally meant deleting any other row dropped the profile
        // you were working in, which read as the app forgetting what was
        // playing.
        if (wasSelected) {
          if (successor) {
            setPresetName(successor);
            // Attaching too, not just selecting: the output has to be playing
            // through something, and the row marked ON must be the truth.
            handleLoadPreset(successor);
          } else {
            setPresetName('');
          }
        }
      } catch (e) {
        // Said, like every other failure on this bar: the bin used to do
        // nothing visible when the file could not be deleted, and the profile
        // stayed in the list with no word about why.
        setGlobalError(e as ErrorDescription);
      }
    },
    [
      activeDeviceId,
      enterMainEditor,
      deletePreset,
      refreshOutputProfiles,
      presetName,
      presetNames,
      handleLoadPreset,
      setGlobalError,
    ],
  );

  // Renaming an existing preset
  const handleRenameExistingPresetName = useCallback(
    (oldName: string) => async (newName: string) => {
      try {
        await enterMainEditor(activeDeviceId);
        await renamePreset(oldName, newName, activeDeviceId);
        if (profileOutputKey() !== activeDeviceId) {
          return;
        }
        await refreshOutputProfiles();
        if (profileOutputKey() !== activeDeviceId) {
          return;
        }
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
    [
      activeDeviceId,
      enterMainEditor,
      refreshOutputProfiles,
      renamePreset,
      setGlobalError,
    ],
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

  // No card of its own: this is the lower half of the Output card, under the
  // output the profiles play through (DeviceProfiles gives it its place). A
  // small caps label and the count stand over the list, where the card's
  // title used to.
  return (
    <div
      className="presets-bar"
      onClickCapture={() => {
        enterMainEditor(activeDeviceId).catch((error) =>
          setGlobalError(error as ErrorDescription),
        );
      }}
    >
      <div className="presets-bar__head">
        <span className="eyebrow">{t('profiles.title')}</span>
        {hasResolvedOutput && (
          <span className="presets-bar__count">
            {visiblePresetNames.length}
          </span>
        )}
      </div>
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
      {/* No name box. Naming happens where the name is: the edit control on
          the profile row itself. A second place to type it was one more
          thing to keep in sync with the list, and it made Save ambiguous —
          you could never tell whether it would create or overwrite.

          One row of three, Update last and the only loud one: it is the
          recommended press. It used to be a full-width button over the other
          two, which made a save the biggest thing on the panel. */}
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
        {/* Always an update now, never a create — New profile is the only way
            to make one, so this can say exactly what it does. */}
        <Button
          ariaLabel={t('profiles.saveAria')}
          className="small profile-actions__save"
          isDisabled={isBlockingError || !presetName}
          handleChange={handleSavePreset}
        >
          <ProfileActionIcon action="save" />
          {t('profiles.update')}
        </Button>
      </div>
    </div>
  );
};

export default PresetsBar;
