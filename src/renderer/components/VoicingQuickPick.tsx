/* FluidEQ — GPL-3.0-or-later */
import { memo } from 'react';
import GenreNotesPreview from '../dsp/GenreNotesPreview';
import GameSoundPresetButton from '../games/GameSoundPresetButton';
import { useSoundingGame } from '../games/useGameSound';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick from '../widgets/RichPick';
import useVoicingPick from './useVoicingPick';
import '../styles/VoicingQuickPick.scss';

/**
 * The equaliser's preset pick, on its toolbar and on the player's deck.
 *
 * Memoised, and on the layers rather than the whole context, because both
 * parents re-render with every frame of a band being dragged: each of those
 * renders read the saved chains and the stars out of storage, parsed and
 * clamped them (`useDspPresetCatalog`) and rebuilt forty to eighty rows with
 * their hints and icons, for a menu nobody had open. It takes no props, so it
 * now renders when something it reads changes — the language, a saved chain
 * or a star, the rack, a layer, the engine — and not when its parent does.
 * What it lists and what a pick does are `useVoicingPick`'s; which preset
 * plays is read as the titlebar's plate reads it (`usePlayingPreset`).
 */
const VoicingQuickPick = memo(() => {
  const { t } = useTranslation();
  const pick = useVoicingPick();
  // A game's own sound loaded: the game is the preset, changed only in the
  // Gaming Lab, which the pick's place opens (`GameSoundPresetButton`).
  const sounding = useSoundingGame();
  if (sounding) {
    return <GameSoundPresetButton game={sounding} />;
  }
  return (
    <RichPick
      className="voicing-pick"
      entries={pick.entries}
      groupLabel={pick.groupLabel}
      menuClassName="dsp-chain-preset-menu"
      favourites={pick.favourites}
      activeId={pick.activeId}
      onPick={pick.apply}
      placeholder={
        pick.activeId !== 'none'
          ? (pick.active?.name ?? t('dsp.eqPreset.custom'))
          : t('voicing.none')
      }
      placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
      triggerAriaLabel={t('dsp.presets')}
      triggerTitle={t('dsp.presets')}
      disabled={pick.isDisabled}
      renderPreview={(id, close) => (
        <GenreNotesPreview chainId={id} closeMenu={close} />
      )}
    />
  );
});
export default VoicingQuickPick;
