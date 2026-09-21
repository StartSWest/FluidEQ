/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IGameProfile } from '../../common/games';
import { TranslationKey } from '../../common/i18n/en';
import DspBarIcon from '../dsp/DspBarIcon';
import {
  IDspCatalogEntry,
  QUICK_DSP_PRESETS,
  dspPresetHint,
} from '../dsp/dspPresetCatalog';
import VoicingIcon from '../icons/VoicingIcon';
import GameIcon from './GameIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick from '../widgets/RichPick';
import { setGameProfilePreset } from './gameProfiles';

interface IGameRowProps {
  profile: IGameProfile;
  catalog: readonly IDspCatalogEntry[];
  /** The starred chains, in the order they were starred. */
  favourites: readonly IDspCatalogEntry[];
  /** Its game is the window in front now. */
  isPlaying: boolean;
  /**
   * Its sound is the one playing, which lasts as long as the game runs.
   *
   * The row says this rather than merely which game is in front: this page is
   * only ever looked at from outside the game, so "in front" alone was never
   * lit while anybody could read it.
   */
  isSounding: boolean;
  onRemove: () => void;
}

/** The row's own "do nothing", which is not a chain and cannot be one. */
export const GAME_PRESET_NONE = 'none';

/** Where the starred chains file, exactly as the equaliser's quick pick files
 * them: first, under their own heading, and once — a chain listed twice is two
 * rows lit at the same time. */
const FAVOURITE_GROUP = 'favorites';

/**
 * One game and the sound it plays.
 *
 * The sound is chosen from the same list as everywhere else — the starred
 * chains first, then the usual ones, in the same order under the same
 * headings — so the name a player picks here is the name they picked on the
 * equaliser's page. "Leave it as it is" heads it, because a game somebody has
 * added to watch what it does is a game with no sound of its own yet.
 */
const GameRow = ({
  profile,
  catalog,
  favourites,
  isPlaying,
  isSounding,
  onRemove,
}: IGameRowProps) => {
  const { t } = useTranslation();
  const starred = new Set(favourites.map((preset) => preset.id));
  const usual = QUICK_DSP_PRESETS.flatMap((id) => {
    const preset = catalog.find((one) => one.id === id);
    return preset && !starred.has(id) ? [{ ...preset, group: 'usual' }] : [];
  });
  const rest = catalog.filter(
    (preset) =>
      !starred.has(preset.id) && !QUICK_DSP_PRESETS.includes(preset.id),
  );
  const entries = [
    {
      id: GAME_PRESET_NONE,
      name: t('games.preset.none'),
      group: '',
      hint: t('games.preset.noneHint'),
      icon: <VoicingIcon className="rich-pick__glyph" />,
    },
    ...[
      ...favourites.map((preset) => ({ ...preset, group: FAVOURITE_GROUP })),
      ...usual,
      ...rest,
    ].map((preset) => ({
      id: preset.id,
      name: preset.name,
      group: preset.group,
      hint: dspPresetHint(preset, t),
      icon: <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />,
    })),
  ];
  const chosen = catalog.find((preset) => preset.id === profile.presetId);

  return (
    <li className={`games-row${isPlaying || isSounding ? ' is-playing' : ''}`}>
      <GameIcon program={profile} className="games-row__glyph" />
      <div className="games-row__what">
        <span className="games-row__name">
          {profile.name}
          {isPlaying || isSounding ? (
            <span className="games-row__now">
              {isPlaying ? t('games.row.inFront') : t('games.row.sounding')}
            </span>
          ) : undefined}
        </span>
        <span className="games-row__where" title={profile.path}>
          {profile.path}
        </span>
      </div>
      <RichPick
        className="games-row__sound"
        entries={entries}
        groupLabel={(group) => {
          if (group === '') {
            return '';
          }
          if (group === FAVOURITE_GROUP) {
            return t('dsp.favorites.title');
          }
          return group === 'usual'
            ? t('dsp.quick.classics')
            : t(`dsp.eqPresetGroup.${group}` as TranslationKey);
        }}
        activeId={profile.presetId === '' ? GAME_PRESET_NONE : profile.presetId}
        onPick={(id) =>
          setGameProfilePreset(profile.id, id === GAME_PRESET_NONE ? '' : id)
        }
        placeholder={chosen?.name ?? t('games.preset.none')}
        placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
        triggerAriaLabel={t('games.row.sound', { name: profile.name })}
        triggerTitle={t('games.row.sound', { name: profile.name })}
      />
      <button
        type="button"
        className="button small subtle games-row__remove"
        title={t('games.row.remove', { name: profile.name })}
        aria-label={t('games.row.remove', { name: profile.name })}
        onClick={onRemove}
      >
        <DspBarIcon name="delete" />
      </button>
    </li>
  );
};

export default GameRow;
