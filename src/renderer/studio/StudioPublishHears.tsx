/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { SIGNALS, type TCameraSignal } from './publishCameraSettings';

interface IStudioPublishHearsProps {
  signal: TCameraSignal;
  demoPlaying: boolean;
  disabled: boolean;
  hint?: string;
  onSelect: (next: TCameraSignal) => void;
}

/**
 * What the scene hears in the Publish dialog, as the app's segmented
 * control. Demo reads as chosen only while the loop sounds: once the take
 * recorded on it is finished the loop stops (`useDemoEndsWithTake`), and
 * neither choice is lit — nothing is playing — until one is pressed.
 */
export default function StudioPublishHears({
  signal,
  demoPlaying,
  disabled,
  hint,
  onSelect,
}: IStudioPublishHearsProps) {
  const { t } = useTranslation();
  return (
    <div
      className="segmented studio-publish__hears"
      role="group"
      aria-label={t('studio.publish.hears')}
    >
      {SIGNALS.map((entry) => {
        const chosen =
          entry.signal === 'live'
            ? signal === 'live'
            : signal === 'showcase' && demoPlaying;
        return (
          <button
            key={entry.signal}
            type="button"
            className={`segmented__option${chosen ? ' is-selected' : ''}`}
            aria-pressed={chosen}
            disabled={disabled}
            title={hint}
            onClick={() => onSelect(entry.signal)}
          >
            {t(entry.key)}
          </button>
        );
      })}
    </div>
  );
}
