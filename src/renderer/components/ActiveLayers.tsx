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

import { ErrorDescription } from 'common/errors';
import { getVoicingProfile } from 'common/voicing';
import { getDriverProfile } from 'common/driver';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import {
  clearConvolution,
  clearHeadset,
  setDriver as setDriverApi,
  setVoicing as setVoicingApi,
} from '../utils/equalizerApi';
import MenuIcon, { MenuIconName } from '../icons/MenuIcon';
import VoicingIcon from '../icons/VoicingIcon';
import '../styles/ActiveLayers.scss';

/**
 * What is shaping the sound besides the bands on screen.
 *
 * The EQ page shows an editor full of bands and nothing else, which is a lie
 * whenever a convolution, a voicing or a driver correction is also live — all
 * three are written into the same Equalizer APO chain and all three are
 * audible, but none of them appear in the editor. People chased phantom bumps
 * in the graph because the thing causing them was on another tab.
 *
 * Each chip removes its own layer, because the tab that owns it is the one
 * place you would otherwise have to go to turn it off.
 */
const ActiveLayers = () => {
  const {
    convolution,
    voicing,
    driver,
    headset,
    headsetTarget,
    isEnabled,
    isBlockingError,
    refreshState,
    setConvolution,
    setVoicing,
    setDriver,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();

  const voicingProfile = getVoicingProfile(voicing?.profileId ?? '');
  const driverProfile = getDriverProfile(driver?.profileId ?? '');

  const layers: {
    key: string;
    icon?: MenuIconName;
    isVoicing?: boolean;
    label: string;
    name: string;
    onClear: () => Promise<void>;
    /** Overrides the generic "remove this layer" wording. */
    clearHint?: string;
  }[] = [];

  // First, because it is what the bands themselves came from rather than
  // something stacked after them. Its remove button forgets the attribution
  // and leaves the bands alone — by the time you want it gone you have usually
  // tuned on top of it, and it is the label that has stopped being true.
  if (headset) {
    layers.push({
      key: 'headset',
      icon: 'model',
      label: t('eq.layers.headset'),
      // Model and measurement, because a model on its own is ambiguous — most
      // have several measurements and they do not sound alike.
      name: headsetTarget ? `${headset} · ${headsetTarget}` : headset,
      clearHint: t('eq.layers.forget'),
      onClear: async () => {
        await clearHeadset();
        await refreshState();
      },
    });
  }

  if (convolution) {
    layers.push({
      key: 'convolution',
      icon: 'convolution',
      label: t('eq.layers.convolution'),
      name: convolution.name,
      onClear: async () => {
        // Optimistic: the chip has to go the moment it is clicked, or a slow
        // config write reads as a dead button.
        setConvolution(undefined);
        await clearConvolution();
        await refreshState();
      },
    });
  }

  if (voicingProfile && (voicing?.intensity ?? 0) > 0) {
    layers.push({
      key: 'voicing',
      isVoicing: true,
      label: t('eq.layers.voicing'),
      name: `${voicingProfile.name} · ${Math.round((voicing?.intensity ?? 0) * 100)}%`,
      onClear: async () => {
        setVoicing({ profileId: '', intensity: voicing?.intensity ?? 1 });
        await setVoicingApi('', voicing?.intensity ?? 1);
        await refreshState();
      },
    });
  }

  if (driverProfile && (driver?.intensity ?? 0) > 0) {
    layers.push({
      key: 'driver',
      icon: 'waveform',
      label: t('eq.layers.driver'),
      name: `${driverProfile.name} · ${Math.round((driver?.intensity ?? 0) * 100)}%`,
      onClear: async () => {
        setDriver({ profileId: '', intensity: driver?.intensity ?? 0.6 });
        await setDriverApi('', driver?.intensity ?? 0.6);
        await refreshState();
      },
    });
  }

  if (layers.length === 0) {
    return null;
  }

  return (
    <div className="active-layers" aria-label={t('eq.layers.aria')}>
      <span className="active-layers__lede">{t('eq.layers')}</span>
      {layers.map((layer) => (
        <span className="active-layer" key={layer.key}>
          {layer.isVoicing ? (
            <VoicingIcon
              profileId={voicing?.profileId}
              className="active-layer__icon"
            />
          ) : (
            <MenuIcon
              name={layer.icon as MenuIconName}
              className="active-layer__icon"
            />
          )}
          <span className="active-layer__label">{layer.label}</span>
          <span className="active-layer__name" title={layer.name}>
            {layer.name}
          </span>
          <button
            type="button"
            aria-label={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            title={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            disabled={isBlockingError || !isEnabled}
            onClick={() =>
              layer
                .onClear()
                .catch((e) => setGlobalError(e as ErrorDescription))
            }
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
};

export default ActiveLayers;
