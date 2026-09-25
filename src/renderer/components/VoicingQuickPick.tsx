/* FluidEQ — GPL-3.0-or-later */
import { memo } from 'react';
import {
  NONE_CHAIN_ID,
  QUICK_DSP_PRESETS,
  activeDspPresetId,
  dspPresetHint,
  useDspPresetCatalog,
} from '../dsp/dspPresetCatalog';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../dsp/store';
import { useDspPresetSelection } from '../dsp/useDspPresetSelection';
import { toggleFavouriteDspPreset } from '../dsp/favouriteDspPresets';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import RichPick from '../widgets/RichPick';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
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
 */
const VoicingQuickPick = memo(() => {
  const { t } = useTranslation();
  const settings = useDspSettings();
  const { favorites, catalog } = useDspPresetCatalog(t);
  const { isEnabled, isBlockingError, voicing } = useFluidEqLayers();
  // What the window already holds: asking main on mount ran the engine
  // helper again every time the equaliser's page or the player's deck opened.
  const status = useKnownAudioEngineStatus();
  const isApo = status?.engine === 'apo';
  // One None for two states: nothing chosen at all, and the None chain the
  // DSP page may have put on a running rack. Picked here, it is the first.
  const chosen = activeDspPresetId(settings, voicing);
  const activeId =
    chosen === undefined || chosen === NONE_CHAIN_ID ? 'none' : chosen;
  const { apply, selecting } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const active = catalog.find((preset) => preset.id === activeId);
  const favoritesIds = new Set(favorites.map((preset) => preset.id));
  const entries = [
    ...favorites.map((preset) => ({ ...preset, group: 'favorites' })),
    ...QUICK_DSP_PRESETS.flatMap((id) => {
      const preset = catalog.find((one) => one.id === id);
      // Equalizer APO takes a chain's EQ curve and nothing else, so there a
      // Room copy is the chain it copies under a name that promises a room.
      const isOffered =
        preset !== undefined &&
        !favoritesIds.has(id) &&
        !(isApo && preset.settings.room.enabled);
      return isOffered ? [{ ...preset, group: 'classic' }] : [];
    }),
    ...catalog.filter(
      (preset) => preset.group === 'genre' && !favoritesIds.has(preset.id),
    ),
  ];
  return (
    <RichPick
      className="voicing-pick"
      entries={[
        {
          id: 'none',
          name: t('voicing.none'),
          group: '',
          hint: t('voicing.none.hint'),
          icon: <VoicingIcon className="rich-pick__glyph" />,
        },
        ...entries.map((preset) => ({
          id: preset.id,
          name: preset.name,
          group: preset.group,
          hint: isApo ? t('dsp.quick.apo') : dspPresetHint(preset, t),
          icon: (
            <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
          ),
        })),
      ]}
      groupLabel={(group) => {
        if (group === '') {
          return '';
        }
        if (group === 'favorites') {
          return t('dsp.favorites.title');
        }
        return t(
          group === 'genre' ? 'voicing.groupGenre' : 'dsp.quick.classics',
        );
      }}
      // Starred here as on the DSP page's picker, into the same list — both
      // pickers file it first and follow each other's stars — and in the
      // same menu style. Every chain the app knows is passed as known, so a
      // star this picker does not show (a saved chain starred there) stays.
      menuClassName="dsp-chain-preset-menu"
      favourites={{
        ids: favorites.map((preset) => preset.id),
        onToggle: (id) =>
          toggleFavouriteDspPreset(
            id,
            catalog.map((preset) => preset.id),
          ),
        addLabel: t('library.playlist.addToFavorites'),
        removeLabel: t('library.playlist.removeFromFavorites'),
        exclude: ['none'],
      }}
      activeId={activeId}
      onPick={apply}
      placeholder={
        activeId !== 'none'
          ? (active?.name ?? t('dsp.eqPreset.custom'))
          : t('voicing.none')
      }
      placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
      triggerAriaLabel={t('dsp.presets')}
      triggerTitle={t('dsp.presets')}
      disabled={isBlockingError || !isEnabled || selecting}
    />
  );
});
export default VoicingQuickPick;
