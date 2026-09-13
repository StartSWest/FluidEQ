/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import type {
  ILightingDevice,
  TLightingKind,
} from 'common/lighting/lightingModel';
import {
  deviceLightingGroup,
  deviceTuning,
  type ILightingProfile,
  type TLightingEffect,
} from 'common/lighting/lightingProfiles';
import { useTranslation } from '../../utils/I18nContext';
import Switch from '../../widgets/Switch';
import type { IDeskColourFeed } from './deskColours';
import LightingKindGlyph from './LightingKindGlyph';

const KIND_KEYS: Record<TLightingKind, TranslationKey> = {
  keyboard: 'lighting.kind.keyboard',
  mouse: 'lighting.kind.mouse',
  mousepad: 'lighting.kind.mousepad',
  headset: 'lighting.kind.headset',
  keypad: 'lighting.kind.keypad',
  stand: 'lighting.kind.stand',
  speaker: 'lighting.kind.speaker',
  accessory: 'lighting.kind.accessory',
};

const ROUTE_KEYS: Record<ILightingDevice['route'], TranslationKey> = {
  synapse: 'lighting.route.synapse',
  windows: 'lighting.route.windows',
  none: 'lighting.route.none',
};

/** Readable colour groups in lamp order, outlined even when their LEDs are dark. */
const paintLamps = (
  canvas: HTMLCanvasElement,
  rgb: Uint8Array | undefined,
  count: number,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  // Sixteen wide swatches remain legible on a compact row. Average each group
  // so a narrow bright region does not disappear between sampled lamps.
  const cells = Math.min(16, Math.max(1, count));
  const edge = height / 18;
  const gap = edge * 2;
  const cellWidth = (width - gap * (cells - 1)) / cells;
  for (let cell = 0; cell < cells; cell += 1) {
    const first = Math.floor((cell / cells) * count);
    const last = Math.floor(((cell + 1) / cells) * count);
    const lit = rgb && rgb.length >= last * 3 && last > first;
    const colour = [0, 0, 0];
    if (lit) {
      for (let lamp = first; lamp < last; lamp += 1) {
        for (let channel = 0; channel < 3; channel += 1) {
          colour[channel] += rgb[lamp * 3 + channel] / (last - first);
        }
      }
    }
    context.fillStyle = lit
      ? `rgb(${colour.join(', ')})`
      : 'rgba(214, 233, 247, 0.08)';
    context.beginPath();
    context.roundRect(
      cell * (cellWidth + gap) + edge / 2,
      edge / 2,
      cellWidth - edge,
      height - edge,
      Math.min(3, cellWidth / 2),
    );
    context.fill();
    context.lineWidth = edge;
    context.strokeStyle = 'rgba(214, 233, 247, 0.35)';
    context.stroke();
  }
};

interface IRowProps {
  device: ILightingDevice;
  feed: IDeskColourFeed | undefined;
  onMute?: (device: ILightingDevice, muted: boolean) => void;
  onSelect?: (device: ILightingDevice) => void;
  selected?: boolean;
  effect?: TLightingEffect;
}

function LightingDeviceRow({
  device,
  feed,
  onMute,
  onSelect,
  selected,
  effect,
}: IRowProps) {
  const { t } = useTranslation();
  const switchId = useId();
  const lampsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lampsRef.current;
    if (!canvas) {
      return undefined;
    }
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    paintLamps(canvas, undefined, device.lamps.length);
    return feed?.subscribe(({ colours }) =>
      paintLamps(canvas, colours.get(device.key), device.lamps.length),
    );
  }, [feed, device.key, device.lamps.length]);

  // Windows can release one device. Our current Chroma connection uses
  // shared category channels, so it cannot honour a separate device switch.
  const switchable = device.route === 'windows' && onMute !== undefined;

  return (
    <li
      className={`lighting-device${device.muted ? ' is-muted' : ''}${selected ? ' is-selected' : ''}`}
    >
      <button
        type="button"
        className="lighting-device__pick"
        onClick={() => onSelect?.(device)}
        disabled={!onSelect || device.route === 'none'}
        aria-pressed={selected}
        aria-label={t('lighting.device.edit', { name: device.name })}
        title={t('lighting.device.edit', { name: device.name })}
      >
        <span className="lighting-device__glyph">
          <LightingKindGlyph kind={device.kind} />
        </span>
        <span className="lighting-device__text">
          <span className="lighting-device__name" title={device.name}>
            {device.name}
          </span>
          <span className="lighting-device__kind">
            {t(KIND_KEYS[device.kind])}
            {effect && (
              <span className="lighting-device__effect">
                {t(`lighting.effect.${effect}`)}
              </span>
            )}
          </span>
        </span>
        {onSelect && (
          <svg
            className="lighting-device__chevron"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M2 4h12M2 8h12M2 12h12M5 2v4M11 6v4M7 10v4" />
          </svg>
        )}
      </button>
      <span className={`lighting-route lighting-route--${device.route}`}>
        {t(ROUTE_KEYS[device.route])}
      </span>
      <span className="lighting-device__output">
        <canvas
          ref={lampsRef}
          className="lighting-device__lamps"
          aria-hidden="true"
        />
        <span className="lighting-device__control">
          {switchable && (
            <Switch
              id={switchId}
              isOn={!device.muted}
              isDisabled={false}
              ariaLabel={t('lighting.device.toggle', { name: device.name })}
              handleToggle={() => onMute?.(device, !device.muted)}
            />
          )}
        </span>
      </span>
    </li>
  );
}

interface IListProps {
  devices: readonly ILightingDevice[];
  searching: boolean;
  feed?: IDeskColourFeed;
  onMute?: (device: ILightingDevice, muted: boolean) => void;
  onSelect?: (device: ILightingDevice) => void;
  selectedGroup?: string;
  profile?: ILightingProfile;
}

export default function LightingDevices({
  devices,
  searching,
  feed,
  onMute,
  onSelect,
  selectedGroup,
  profile,
}: IListProps) {
  const { t } = useTranslation();
  if (searching) {
    return (
      <p className="lighting-devices__searching">
        {t('lighting.devices.searching')}
      </p>
    );
  }
  if (devices.length === 0) {
    return (
      <div className="lighting-devices__none">
        <span className="lighting-devices__none-title">
          {t('lighting.devices.none.title')}
        </span>
        <span className="lighting-devices__none-body">
          {t('lighting.devices.none.body')}
        </span>
      </div>
    );
  }
  const razerTogether =
    devices.filter((device) => device.route === 'synapse').length > 1;
  return (
    <>
      <ul className="lighting-devices__list">
        {devices.map((device) => (
          <LightingDeviceRow
            key={device.key}
            device={device}
            feed={feed}
            onMute={onMute}
            onSelect={onSelect}
            selected={selectedGroup === deviceLightingGroup(device)}
            effect={
              profile
                ? deviceTuning(profile, deviceLightingGroup(device)).effect
                : undefined
            }
          />
        ))}
      </ul>
      {razerTogether && (
        <p className="lighting-devices__fine">
          {t('lighting.devices.together')}
        </p>
      )}
    </>
  );
}
