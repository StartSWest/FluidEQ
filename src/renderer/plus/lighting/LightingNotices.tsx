/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { ILightingState } from 'common/lighting/lightingModel';
import { useTranslation } from '../../utils/I18nContext';

type TNotice = 'windows' | 'chroma' | 'apps-off';

/**
 * What is standing between a device and the scene, said only once it is
 * actually happening: Windows holding a device for the app in front, or Razer
 * Chroma not answering or refusing apps. Each can be put aside for the rest of
 * the session; none of them is a warning in advance.
 */
export default function LightingNotices({ state }: { state: ILightingState }) {
  const { t, locale } = useTranslation();
  const [dismissed, setDismissed] = useState<ReadonlySet<TNotice>>(new Set());
  const api = window.electron?.ipcRenderer;

  const notices: TNotice[] = [];
  if (state.heldByWindows.length > 0) {
    notices.push('windows');
  }
  if (state.hasRazerDevices && state.synapse === 'not-running') {
    notices.push('chroma');
  }
  if (state.hasRazerDevices && state.synapse === 'apps-off') {
    notices.push('apps-off');
  }
  const shown = notices.filter((notice) => !dismissed.has(notice));
  if (shown.length === 0) {
    return null;
  }

  const later = (notice: TNotice) =>
    setDismissed((current) => new Set([...current, notice]));
  const devices = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    state.heldByWindows,
  );

  return (
    <div className="lighting-notices">
      {shown.map((notice) => (
        <div
          key={notice}
          className={`lighting-notice lighting-notice--${notice}`}
          role="status"
        >
          <span className="lighting-notice__mark" aria-hidden="true">
            {notice === 'windows' ? 'i' : '!'}
          </span>
          <span className="lighting-notice__text">
            <span className="lighting-notice__title">
              {notice === 'windows' &&
                t('lighting.notice.windows.title', { devices })}
              {notice === 'chroma' && t('lighting.notice.chroma.title')}
              {notice === 'apps-off' && t('lighting.notice.appsOff.title')}
            </span>
            <span className="lighting-notice__body">
              {notice === 'windows' && t('lighting.notice.windows.body')}
              {notice === 'chroma' && t('lighting.notice.chroma.body')}
              {notice === 'apps-off' && t('lighting.notice.appsOff.body')}
            </span>
          </span>
          <span className="lighting-notice__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={() => later(notice)}
            >
              {t('output.notNow')}
            </button>
            {notice === 'windows' && (
              <button
                type="button"
                className="button small"
                onClick={() => {
                  api?.openWindowsLightingSettings().catch(() => undefined);
                }}
              >
                {t('lighting.notice.windows.action')}
              </button>
            )}
            {notice !== 'windows' && state.canOpenRazerChroma && (
              <button
                type="button"
                className="button small"
                onClick={() => {
                  api?.openRazerChroma().catch(() => undefined);
                }}
              >
                {t('lighting.notice.chroma.action')}
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
