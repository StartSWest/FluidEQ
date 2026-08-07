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

import { useRef } from 'react';
import { ErrorDescription } from 'common/errors';
import { TApoLayer } from 'common/constants';
import { getVoicingProfile } from 'common/voicing';
import { getDriverProfile } from 'common/driver';
import { hasSmartEqLayer } from 'common/smartEq';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import {
  clearConvolution,
  clearHeadset,
  setDriver as setDriverApi,
  setLayerBypass,
  setSmartEq as setSmartEqApi,
  setVoicing as setVoicingApi,
} from '../utils/equalizerApi';
import { formatBalanceFrequency } from '../utils/autoBalance';
import MenuIcon, { MenuIconName } from '../icons/MenuIcon';
import VoicingIcon from '../icons/VoicingIcon';
import '../styles/ActiveLayers.scss';

/**
 * What is shaping the sound besides the bands on screen.
 *
 * The EQ page shows an editor full of bands and nothing else, which is a lie
 * whenever a convolution, a voicing, a driver correction or a measured Smart EQ
 * curve is also live — every one of them is written into the same Equalizer APO
 * chain and every one is audible, but none appear in the editor. People chased
 * phantom bumps in the graph because the thing causing them was on another tab.
 *
 * Each chip removes its own layer, because the tab that owns it is the one
 * place you would otherwise have to go to turn it off.
 */
const ActiveLayers = () => {
  const {
    filters,
    convolution,
    voicing,
    driver,
    smartEq,
    headset,
    headsetTarget,
    isEnabled,
    isBlockingError,
    bypassed,
    refreshState,
    setConvolution,
    setVoicing,
    setDriver,
    setSmartEq,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();

  const isBypassed = (layer: TApoLayer) => bypassed.includes(layer);

  /**
   * Whether the bands still match what the reference model wrote.
   *
   * There is no flag for this anywhere — the model writes bands and then it is
   * simply bands, indistinguishable from ones dragged by hand. So the shape is
   * remembered at the moment a model arrives, and compared against on every
   * render after it: a different signature means somebody has moved something.
   *
   * Keyed on the model, so choosing a different one re-snapshots rather than
   * inheriting the last one's "modified". Sorted, because band order in the map
   * is not meaningful and a reordering is not an edit.
   */
  const bandCount = Object.keys(filters).length;
  // Flat means no layer, however many bands are sitting there at zero.
  const hasShapedBands = Object.values(filters).some(
    (f) => Math.abs(f.gain) > 0.01,
  );
  const bandSignature = Object.values(filters)
    .map((f) => `${f.type}:${f.frequency}:${f.gain}:${f.quality}`)
    .sort()
    .join('|');
  const referenceKey = `${headset ?? ''}|${headsetTarget ?? ''}`;
  const eqOrigin = useRef<{ key: string; signature: string } | undefined>(
    undefined,
  );
  if (!eqOrigin.current || eqOrigin.current.key !== referenceKey) {
    eqOrigin.current = { key: referenceKey, signature: bandSignature };
  }
  const isEqModified = eqOrigin.current.signature !== bandSignature;

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
    /**
     * Which file in the Equalizer APO config this chip stands for, and so what
     * its A/B switch takes out of the chain.
     *
     * Every layer written as filters has one. The convolution does not: it is a
     * `Convolution:` line in the device file rather than an include of its own,
     * so there is nothing here to leave out.
     */
    feature?: TApoLayer;
  }[] = [];

  // The row reads in the order the config is written, so the chips and the
  // Equalizer APO chain tell the same story top to bottom. Convolution is
  // first there because it is the base the rest is stacked on.
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
      // Switchable like the rest of the row, now that switching a layer off is
      // a line that is not written rather than settings that are cleared. This
      // was the one chip without a switch, on the grounds that putting it back
      // would mean finding its file again — and it never had to be gone at all.
      // The WAV stays exactly where it is; only the line naming it comes and
      // goes, which is the same act as omitting an Include.
      feature: 'convolution',
    });
  }

  // First, because it is what the bands themselves came from rather than
  // something stacked after them. Its remove button takes the bands with it:
  // the reference is not a label attached to a tuning, it is the tuning, and
  // removing only the label left a curve behind that the EQ page then claimed
  // nothing was responsible for.
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
      feature: 'driver',
    });
  }

  // The bands, and where they came from — one chip, because an AutoEQ model
  // *is* the manual EQ auto-tuned. Same filters, same layer, different origin,
  // so two chips would have listed the same thing twice.
  //
  // Named by the model and its measurement when the bands came from one: a
  // model alone is ambiguous, since most have several measurements and they do
  // not sound alike. Named by how many bands there are when they were placed by
  // hand, which is the only honest thing to say about a tuning with no source.
  //
  // Marked modified once the bands no longer match what the model wrote.
  // Without that the chip goes on claiming a curve that is not on screen any
  // more, and editing a reference tuning is the most ordinary thing anybody
  // does here.
  // Only once there is something to say. A row of bands all sitting at 0 dB is
  // a flat EQ — the default state of the app — and listing it as an applied
  // layer would mean the chip is there from the first launch, saying nothing,
  // for everybody. Clearing the EQ puts every gain back to zero, so the chip
  // goes on its own.
  if (headset || hasShapedBands) {
    const reference = headsetTarget ? `${headset} · ${headsetTarget}` : headset;
    layers.push({
      key: 'eq',
      icon: 'model',
      label: t('eq.layers.eq'),
      name: headset
        ? `${reference}${isEqModified ? ` ${t('eq.layers.eq.modified')}` : ''}`
        : t('eq.layers.eq.bands', { count: String(bandCount) }),
      // Only offered when there is a reference to clear. Bands placed by hand
      // are cleared with Clear EQ, and a second route to deleting somebody's
      // tuning is not something this row should grow.
      clearHint: headset ? t('eq.layers.clearReference') : undefined,
      onClear: async () => {
        if (headset) {
          await clearHeadset();
          await refreshState();
        }
      },
      // The purest A/B in the app: the whole tuning out, the whole tuning back.
      //
      // It works because the bands are a file now. Switching them off is the
      // `Include:` line not being written, so the tuning is never touched —
      // where the first attempt at this had to clear every gain and put them
      // back one at a time, which half-succeeded and left the chip describing a
      // state it could not render.
      //
      // Nothing has to keep the chip on screen either. Bypass no longer
      // flattens the gains this condition tests, so a switched-off EQ is still
      // a shaped one and the chip stays of its own accord.
      feature: 'eq',
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
      feature: 'voicing',
    });
  }

  // Last, because it is written last: it corrects the residual of everything
  // above it. Clearing it takes nothing else with it — not the bands, not the
  // reference they came from, not the other two layers — which is the whole
  // point of it being a layer at all.
  if (hasSmartEqLayer(smartEq)) {
    layers.push({
      key: 'smart',
      icon: 'smart',
      label: t('eq.layers.smart'),
      // A partial measurement corrected the range it managed to hear and left
      // the rest alone, so saying which range is the difference between a
      // result and a mystery.
      name:
        smartEq?.status === 'partial' &&
        smartEq.lowFrequency &&
        smartEq.highFrequency
          ? t('eq.layers.smart.range', {
              low: formatBalanceFrequency(smartEq.lowFrequency),
              high: formatBalanceFrequency(smartEq.highFrequency),
            })
          : t('eq.layers.smart.fullRange'),
      clearHint: t('eq.layers.clearSmart'),
      onClear: async () => {
        setSmartEq(undefined);
        await setSmartEqApi(undefined);
        await refreshState();
      },
      feature: 'smart',
    });
  }

  // Empty, but still there.
  //
  // This row grows as somebody works — the first band they shape, the first
  // voicing they try — and appearing from nothing pushed the whole editor down
  // under their hands mid-drag. A control that moves while you are using it is
  // the worst thing an interface can do, and it happened at exactly the moment
  // somebody was tuning for the first time.
  //
  // So the space is always reserved and the row simply has nothing in it. One
  // line of height is a small price for an editor that never moves; the
  // alternative was floating it over the layout, which trades the jump for a
  // strip that covers whatever is underneath.
  if (layers.length === 0) {
    return <div className="active-layers is-empty" aria-hidden />;
  }

  return (
    <div className="active-layers" aria-label={t('eq.layers.aria')}>
      <span className="active-layers__lede">{t('eq.layers')}</span>
      {layers.map((layer) => (
        <span
          className={`active-layer${
            layer.feature && isBypassed(layer.feature) ? ' is-bypassed' : ''
          }`}
          key={layer.key}
        >
          {/* The body of the chip is the A/B switch.

              Pressing it takes the layer out of the config and leaves it here,
              dimmed; pressing again puts it back. Nothing is recomputed either
              way, which is the point — a correction is either an improvement or
              it is not, and the only way to tell is to hear the same passage
              both ways within a few seconds of itself. Removing and re-applying
              is not that: Smart EQ takes half a minute to measure and a cleared
              voicing is one you have to go and find.

              One call each way, and the same call: a layer is switched off by
              its file not being included, so there is no state in between for a
              half-finished press to land in.

              A plain span for the convolution, which is a line in the device
              file rather than an include and so has nothing to leave out. */}
          {layer.feature ? (
            <button
              type="button"
              className="active-layer__body"
              aria-pressed={!isBypassed(layer.feature)}
              disabled={isBlockingError || !isEnabled}
              title={
                isBypassed(layer.feature)
                  ? t('eq.layers.enable', { layer: layer.label })
                  : t('eq.layers.disable', { layer: layer.label })
              }
              onClick={() => {
                const feature = layer.feature as TApoLayer;
                setLayerBypass(feature, !isBypassed(feature))
                  .then(() => refreshState())
                  .catch((e) => setGlobalError(e as ErrorDescription));
              }}
            >
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
            </button>
          ) : (
            <span className="active-layer__body">
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
            </span>
          )}
          <button
            type="button"
            aria-label={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            title={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            disabled={isBlockingError || !isEnabled}
            onClick={() => {
              // Switching it back on is the main process's job, not this
              // button's. Every clear here goes through a handler that already
              // treats a layer being taken away as reason enough — and doing it
              // from this side would have switched the EQ back on even where
              // its X does nothing at all, which is the case for bands nobody
              // applied a reference to.
              layer
                .onClear()
                .catch((e) => setGlobalError(e as ErrorDescription));
            }}
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
