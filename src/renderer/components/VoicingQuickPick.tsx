/* FluidEQ — GPL-3.0-or-later */
import {
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
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import RichPick from '../widgets/RichPick';
import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import '../styles/VoicingQuickPick.scss';

const VoicingQuickPick = () => {
  const { t } = useTranslation();
  const settings = useDspSettings();
  const { favorites, catalog } = useDspPresetCatalog(t);
  const { isEnabled, isBlockingError, voicing } = useFluidEqContext();
  const { status } = useAudioEngineStatus();
  const isApo = status?.engine === 'apo';
  const activeId = activeDspPresetId(settings, voicing) ?? 'none';
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
};
export default VoicingQuickPick;
