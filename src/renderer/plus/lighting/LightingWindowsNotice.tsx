/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n/en';
import {
  lightingProviderLabel,
  type IWindowsHold,
  type TWindowsHoldReason,
} from 'common/lighting/lightingModel';
import { useTranslation } from '../../utils/I18nContext';

/**
 * Windows keeping devices from FluidEQ, and exactly what to change on its
 * Dynamic Lighting page to hand them over — worked out from the member's own
 * settings, so the steps are the ones in their way and no others. One button
 * opens the page Windows needs: Dynamic Lighting, or the developer page for a
 * copy that needs Developer Mode.
 */

const TITLES: Record<TWindowsHoldReason, TranslationKey> = {
  unavailable: 'lighting.windows.unavailable.title',
  'needs-developer-mode': 'lighting.windows.developerMode.title',
  'dynamic-lighting-off': 'lighting.windows.off.title',
  'not-first': 'lighting.windows.notFirst.title',
  waiting: 'lighting.windows.waiting.title',
};

const LEADS: Partial<Record<TWindowsHoldReason, TranslationKey>> = {
  unavailable: 'lighting.windows.unavailable.body',
  'needs-developer-mode': 'lighting.windows.developerMode.body',
  waiting: 'lighting.windows.waiting.body',
};

const VENDOR_TIPS = {
  razer: 'lighting.windows.vendor.razer',
  logitech: 'lighting.windows.vendor.logitech',
  asus: 'lighting.windows.vendor.asus',
} as const satisfies Record<string, TranslationKey>;

interface IProps {
  hold: IWindowsHold;
  onLater: () => void;
}

export default function LightingWindowsNotice({ hold, onLater }: IProps) {
  const { t, locale } = useTranslation();
  const api = window.electron?.ipcRenderer;
  const list = (items: readonly string[]) =>
    new Intl.ListFormat(locale, { type: 'conjunction' }).format(items);
  const devices = list(hold.devices);
  const above = list(
    hold.above.map((provider) => {
      const label = lightingProviderLabel(provider);
      return 'windows' in label ? t('lighting.windows.controller') : label.name;
    }),
  );

  const steps: string[] = [];
  switch (hold.reason) {
    case 'needs-developer-mode':
      steps.push(
        t('lighting.windows.step.openDevelopers'),
        t('lighting.windows.step.developerMode'),
        t('lighting.windows.step.comeBack'),
      );
      break;
    case 'dynamic-lighting-off':
      steps.push(
        t('lighting.windows.step.open'),
        t('lighting.windows.step.turnOn'),
        t('lighting.windows.step.deviceOn'),
      );
      break;
    case 'not-first':
      steps.push(
        t('lighting.windows.step.open'),
        hold.resetNeeded
          ? t('lighting.windows.step.reset')
          : t('lighting.windows.step.list'),
        above
          ? t('lighting.windows.step.dragAbove', { above })
          : t('lighting.windows.step.drag'),
        t('lighting.windows.step.wait'),
      );
      break;
    default:
      break;
  }
  if (hold.reason === 'waiting' && hold.foregroundFirst) {
    steps.push(t('lighting.windows.step.foreground'));
  }

  const lead = LEADS[hold.reason];
  const opensDevelopers = hold.reason === 'needs-developer-mode';
  const opensSettings = hold.reason !== 'unavailable';

  return (
    <div className="lighting-notice lighting-notice--windows" role="status">
      <span className="lighting-notice__mark" aria-hidden="true">
        i
      </span>
      <span className="lighting-notice__text">
        <span className="lighting-notice__title">
          {t(TITLES[hold.reason], { devices })}
        </span>
        {lead && <span className="lighting-notice__body">{t(lead)}</span>}
        {steps.length > 0 && (
          <ol className="lighting-notice__steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
        {hold.reason !== 'needs-developer-mode' &&
          hold.reason !== 'unavailable' &&
          hold.vendors.map((vendor) => (
            <span key={vendor} className="lighting-notice__body">
              {t(VENDOR_TIPS[vendor])}
            </span>
          ))}
      </span>
      <span className="lighting-notice__actions">
        <button type="button" className="button small subtle" onClick={onLater}>
          {t('output.notNow')}
        </button>
        {opensSettings && (
          <button
            type="button"
            className="button small"
            onClick={() => {
              api
                ?.openWindowsLightingSettings(
                  opensDevelopers ? 'developers' : 'lighting',
                )
                .catch(() => undefined);
            }}
          >
            {t(
              opensDevelopers
                ? 'lighting.windows.action.developers'
                : 'lighting.notice.windows.action',
            )}
          </button>
        )}
      </span>
    </div>
  );
}
