/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { IRoomSettings } from '../../common/dsp/chain';
import {
  IRoomPreset,
  ROOM_CLASSIC_LIST,
  ROOM_FEATURED_LIST,
  roomPresetOf,
} from '../../common/dsp/roomPresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import {
  ISavedRoom,
  ISaveRoomResult,
  SAVED_ROOM_NAME_MAX,
  uniqueRoomName,
} from './savedRooms';

interface IDspRoomBarProps {
  room: IRoomSettings;
  saved: readonly ISavedRoom[];
  /** The saved room the card stands in, where it stands in one. */
  savedHere: ISavedRoom | undefined;
  /** What Restore would put back, by name; nothing while there is nothing. */
  restoreName: string | undefined;
  /** Saved rooms are the user's shaping: Plus. */
  isPlus: boolean;
  onPreset: (preset: IRoomPreset) => void;
  onSaved: (saved: ISavedRoom) => void;
  onRestore: () => void;
  onReset: () => void;
  onSave: (name: string) => ISaveRoomResult;
  onDelete: (saved: ISavedRoom) => void;
}

/**
 * The menu's three headings, which say what kind of room is under each. The
 * classic rooms used to file under the other pickers' groups — Basic,
 * Playback, Character — and `playback` had no string in any language, so the
 * menu showed its key in capitals; and with a featured Cinema above them, a
 * second Cinema under "Playback" said nothing about which was which.
 */
const GROUP_KEYS: Record<string, TranslationKey | undefined> = {
  featured: 'dsp.room.featured',
  classic: 'dsp.room.classicRooms',
  saved: 'dsp.eqPreset.saved',
};

/**
 * The rooms, presented with the same picker as the EQ, the Exciter and the
 * Dimension stage, where every other stage has it: a menu, the previous and
 * next arrows for auditioning, and the actions on the room itself beside it.
 *
 * One menu holds all three kinds of room. The six featured rooms lead, each
 * with the line that says what it is for; the eleven classic rooms follow in
 * the groups they always had, sounding exactly as they always did; and the
 * rooms the user shaped and named close it, under "Yours". Every built-in
 * room is free; a saved room is the user's own shaping, which is Plus, so it
 * is shown to everyone and picked by Plus.
 *
 * Restore and Reset are different and say so. Restore puts the room back to
 * the one it was edited away from and leaves the listener alone; it is only
 * there while the card knows what that was. Reset is what it has always been:
 * every option on the page back to how it first opens, the power switch
 * excepted. Save keeps the room beside the ones already saved, under a name
 * of its own, and says so only when storage took it.
 */
const DspRoomBar = ({
  room,
  saved,
  savedHere,
  restoreName,
  isPlus,
  onPreset,
  onSaved,
  onRestore,
  onReset,
  onSave,
  onDelete,
}: IDspRoomBarProps) => {
  const { t } = useTranslation();
  const [isNaming, setIsNaming] = useState(false);
  const [notice, setNotice] = useState('');
  const names = saved.map((one) => one.name);

  const hintOf = (preset: IRoomPreset): string =>
    preset.purposeKey !== undefined
      ? t(preset.purposeKey as TranslationKey)
      : t('dsp.room.presetHint', {
          size: preset.shape.sizeM.toFixed(1),
          distance: preset.shape.distanceM.toFixed(1),
          live: String(Math.round((1 - preset.shape.walls) * 100)),
        });
  const builtIn = [...ROOM_FEATURED_LIST, ...ROOM_CLASSIC_LIST];
  const entries: IRichPickEntry[] = [
    ...builtIn.map((preset) => ({
      id: preset.id,
      name: t(preset.labelKey as TranslationKey),
      hint: hintOf(preset),
      group: preset.collection,
      icon: <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />,
    })),
    ...saved.map((one) => ({
      id: one.id,
      name: one.name,
      hint: t(
        one.shape.rendererVersion === 2
          ? 'dsp.room.savedNew'
          : 'dsp.room.savedClassic',
      ),
      group: 'saved',
      icon: <VoicingIcon className="rich-pick__glyph" />,
      locked: isPlus ? undefined : t('dsp.room.plusHint'),
    })),
  ];
  const groupLabel = (group: string): string => {
    const key = GROUP_KEYS[group];
    return key === undefined ? '' : t(key);
  };

  const pick = (id: string) => {
    setNotice('');
    const preset = roomPresetOf(id);
    if (preset !== undefined) {
      onPreset(preset);
      return;
    }
    const one = saved.find((candidate) => candidate.id === id);
    if (one !== undefined && isPlus) {
      onSaved(one);
    }
  };

  /** The arrows walk the built-in rooms; a saved room is picked by name. */
  const step = (direction: -1 | 1) => {
    const at = builtIn.findIndex((preset) => preset.id === room.presetId);
    const count = builtIn.length;
    pick(
      (at < 0
        ? builtIn[direction > 0 ? 0 : count - 1]
        : builtIn[(at + direction + count) % count]
      ).id,
    );
  };

  return (
    <>
      <div className="dsp-eq-bar dsp-room-bar">
        <div className="dsp-eq-preset dsp-eq-preset-first">
          <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
          <RichPick
            entries={entries}
            groupLabel={groupLabel}
            activeId={savedHere?.id ?? room.presetId}
            onPick={pick}
            placeholder={t('dsp.eqPreset.custom')}
            placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
            triggerAriaLabel={t('dsp.room.presets')}
            triggerTitle={t('dsp.room.presets')}
          />
          <button
            type="button"
            className="dsp-eq-step"
            aria-label={t('dsp.eqPreset.previous')}
            title={t('dsp.eqPreset.previous')}
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button
            type="button"
            className="dsp-eq-step"
            aria-label={t('dsp.eqPreset.next')}
            title={t('dsp.eqPreset.next')}
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </div>

        <div className="dsp-eq-transfer">
          <button
            type="button"
            className="button small subtle"
            title={t('dsp.room.resetHint')}
            onClick={() => {
              setNotice('');
              onReset();
            }}
          >
            <DspBarIcon name="reset" />
            {t('dsp.eqPreset.reset')}
          </button>
          {/* Only while there is something to go back to: a button that is
              present but refuses is worse than one that is not there. */}
          {restoreName !== undefined ? (
            <button
              type="button"
              className="button small subtle"
              title={t('dsp.room.restoreHint', { name: restoreName })}
              onClick={() => {
                setNotice('');
                onRestore();
              }}
            >
              <DspBarIcon name="reset" />
              {t('dsp.room.restore', { name: restoreName })}
            </button>
          ) : undefined}
          <button
            type="button"
            className="button small subtle"
            disabled={!isPlus || !room.enabled}
            title={isPlus ? undefined : t('dsp.room.plusHint')}
            onClick={() => setIsNaming(true)}
          >
            <DspBarIcon name="save" />
            {t('dsp.eqSave.save')}
          </button>
          {savedHere !== undefined && isPlus ? (
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                onDelete(savedHere);
                setNotice(t('dsp.eqSave.deleted', { name: savedHere.name }));
              }}
            >
              <DspBarIcon name="delete" />
              {t('dsp.eqSave.delete')}
            </button>
          ) : undefined}
        </div>
      </div>

      {notice !== '' ? (
        <p className="dsp-eq-notice" role="status">
          {notice}
        </p>
      ) : undefined}

      {isNaming ? (
        <DspPresetSaveDialog
          existing={names}
          titleKey="dsp.room.saveTitle"
          hintKey="dsp.room.saveHint"
          placeholderKey="dsp.room.savePlaceholder"
          nameMax={SAVED_ROOM_NAME_MAX}
          takenText={(name) =>
            t('dsp.room.saveKeepsBoth', { name: uniqueRoomName(name, names) })
          }
          onSave={(name) => {
            const result = onSave(name);
            setNotice(
              result.stored && result.saved !== undefined
                ? t('dsp.eqSave.saved', { name: result.saved.name })
                : t('dsp.room.saveFailed'),
            );
            setIsNaming(false);
          }}
          onClose={() => setIsNaming(false)}
        />
      ) : undefined}
    </>
  );
};

export default DspRoomBar;
