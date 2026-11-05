/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IFootstepsSettings } from '../../common/dsp/footsteps';
import {
  FOOTSTEPS_PRESET_GROUPS,
  footstepsPresetOf,
  IFootstepsPreset,
  isGameRoom,
  TFootstepsPresetGroup,
} from '../../common/dsp/footstepsPresets';
import { IGameRack, pickGame } from '../../common/dsp/gameRoom';
import { roomPresetOf } from '../../common/dsp/roomPresets';
import { FOOTSTEPS_CATALOGUE } from '../../common/dsp/stageCatalogues';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import useStagePresets from './useStagePresets';

interface IDspFootstepsBarProps {
  game: IGameRack;
  onChange: (next: Partial<IGameRack>) => void;
  onCommit: () => void;
}

/** Written out whole: the dead-keys guard reads keys, not templates. */
const GROUP_KEYS: Record<TFootstepsPresetGroup, TranslationKey> = {
  kinds: 'dsp.footstepsPresetGroup.kinds',
  competitive: 'dsp.footstepsPresetGroup.competitive',
  battle: 'dsp.footstepsPresetGroup.battle',
  tactical: 'dsp.footstepsPresetGroup.tactical',
  moba: 'dsp.footstepsPresetGroup.moba',
  rpg: 'dsp.footstepsPresetGroup.rpg',
  story: 'dsp.footstepsPresetGroup.story',
};

const isGroup = (group: string | undefined): group is TFootstepsPresetGroup =>
  (FOOTSTEPS_PRESET_GROUPS as readonly string[]).includes(group ?? '');

/**
 * The Game filter's presets, on the same picker as every other stage: the
 * kinds of game first, then each game by name under its kind, the line
 * under each name saying whether the game has its own 3D sound or which
 * room it is best in. Choosing one starts the filter and sets the Room
 * (`pickGame`); the chains that set this stage decide for themselves
 * whether it runs.
 */
const DspFootstepsBar = ({
  game,
  onChange,
  onCommit,
}: IDspFootstepsBarProps) => {
  const { t } = useTranslation();
  const { footsteps } = game;
  const saved = useStagePresets(
    'footsteps',
    footsteps,
    (next: IFootstepsSettings) => onChange({ footsteps: next }),
    onCommit,
  );

  const nameOf = (preset: IFootstepsPreset): string =>
    preset.title ?? t(preset.labelKey as TranslationKey);
  const roomName = (preset: IFootstepsPreset): string => {
    const room = isGameRoom(preset.room)
      ? roomPresetOf(preset.room)
      : undefined;
    return room ? t(room.labelKey as TranslationKey) : '';
  };
  const hintOf = (preset: IFootstepsPreset): string => {
    if (preset.hintKey) {
      return t(preset.hintKey as TranslationKey);
    }
    if (preset.room === 'own3d') {
      return t('dsp.game.hintOwn3d');
    }
    return preset.room === 'none'
      ? t('dsp.game.hintNoRoom')
      : t('dsp.game.hintRoom', { room: roomName(preset) });
  };

  const factoryEntries: IRichPickEntry[] = FOOTSTEPS_PRESET_GROUPS.flatMap(
    (group) =>
      FOOTSTEPS_CATALOGUE.profiles
        .filter((preset) => preset.group === group)
        .map((preset) => ({
          id: preset.id,
          name: nameOf(preset),
          hint: hintOf(preset),
          group,
          icon: <VoicingIcon className="rich-pick__glyph" />,
        })),
  );
  // Saved profiles first, as the EQ lists its own.
  const entries: IRichPickEntry[] = [...saved.entries, ...factoryEntries];
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string, enable = true) => {
    if (saved.apply(id)) {
      return;
    }
    const preset = footstepsPresetOf(id);
    if (preset === undefined) {
      return;
    }
    onChange(pickGame(game, preset, enable));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(footsteps.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  const picked = footstepsPresetOf(footsteps.presetId);
  let note = t('dsp.footsteps.description');
  if (picked?.room === 'own3d') {
    note = t('dsp.game.noteOwn3d', { game: nameOf(picked) });
  } else if (picked?.room === 'none') {
    note = t('dsp.game.noteNoRoom', { game: nameOf(picked) });
  } else if (picked && isGameRoom(picked.room)) {
    note = t('dsp.game.noteRoom', {
      game: nameOf(picked),
      room: roomName(picked),
    });
  }

  return (
    <>
      <div className="dsp-eq-bar dsp-footsteps-bar">
        <div className="dsp-eq-preset dsp-eq-preset-first">
          <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
          <RichPick
            entries={entries}
            groupLabel={(group) =>
              saved.savedGroupLabel(group) ??
              (isGroup(group) ? t(GROUP_KEYS[group]) : '')
            }
            activeId={footsteps.presetId}
            onPick={applyPreset}
            placeholder={t('dsp.eqPreset.custom')}
            placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
            triggerAriaLabel={t('dsp.eqPreset.label')}
            triggerTitle={t('dsp.eqPreset.label')}
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

        {/* Reset goes to Competitive, which is the stage's own defaults: the
            sound switching the stage on gives. It keeps the switch as it is. */}
        <div className="dsp-eq-transfer">
          <button
            type="button"
            className="button small subtle"
            onClick={() => applyPreset('competitive', false)}
          >
            <DspBarIcon name="reset" />
            {t('dsp.eqPreset.reset')}
          </button>
          {saved.buttons}
        </div>
      </div>

      <p className="dsp-footsteps-note">{note}</p>

      {saved.notice}

      {saved.dialog}
    </>
  );
};

export default DspFootstepsBar;
