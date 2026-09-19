/* FluidEQ — GPL-3.0-or-later */
import { dspPresetHint, useDspPresetCatalog } from '../dsp/dspPresetCatalog';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../dsp/store';
import { useDspPresetSelection } from '../dsp/useDspPresetSelection';
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
  const apoId = voicing?.profileId.startsWith('dsp:')
    ? voicing.profileId.slice(4)
    : 'none';
  const dspId = settings.enabled ? settings.presetId : 'none';
  const activeId = isApo ? apoId : dspId;
  const { apply, selecting } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const active = catalog.find((preset) => preset.id === activeId);
  const classicIds = ['music', 'movie', 'gaming', 'speech', 'late-night'];
  const favoritesIds = new Set(favorites.map((preset) => preset.id));
  const entries = [
    ...favorites.map((preset) => ({ ...preset, group: 'favorites' })),
    ...classicIds.flatMap((id) => {
      const preset = catalog.find((one) => one.id === id);
      return preset && !favoritesIds.has(id)
        ? [{ ...preset, group: 'classic' }]
        : [];
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
          hint: isApo ? t('dsp.quick.apo') : dspPresetHint(preset.settings, t),
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
