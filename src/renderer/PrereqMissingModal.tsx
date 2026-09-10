/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import { useEffect, useState } from 'react';
import { BUNDLED_ENGINE, PRODUCT_NAME } from 'common/branding';
import type { TAudioEngine } from 'common/audioEngine';
import type { IEngineSetupResult } from 'main/engineSetup';
import Button from './widgets/Button';
import { useTranslation } from './utils/I18nContext';
import { startEqualizerApoInstall } from './utils/apoInstall';
import './styles/Modal.scss';

interface IPrereqMissingModalProps {
  /**
   * Which engine the app is trying to use, and therefore which one is
   * missing. Equalizer APO being absent is not a fault at all under
   * `'fluid'` — nothing here may offer to install it in that case, or the
   * repair for one engine is handed to somebody running the other.
   *
   * `null` while the engine status has not answered yet: neither variant's
   * copy is safe to show, because it might name the wrong engine's repair —
   * so nothing engine-specific renders (no title, no credit line, no install
   * button) until it is known. The blocking failure itself still shows.
   */
  engine: TAudioEngine | null;
  isLoading: boolean;
  errorMsg: string;
  actionMsg: string;
  onRetry: () => void;
  onInstallFluid: () => Promise<IEngineSetupResult>;
}

export default function PrereqMissingModal({
  engine,
  isLoading,
  errorMsg,
  actionMsg,
  onRetry,
  onInstallFluid,
}: IPrereqMissingModalProps) {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string>();

  useEffect(() => setIsDismissed(false), [actionMsg, errorMsg]);

  // Opens the copy that shipped inside FluidEQ's own installer. It is already
  // on disk; there is nothing to download and nowhere to go.
  const handleInstallApo = async () => {
    setIsStarting(true);
    setStartError(undefined);
    // Which failure it was, and the download page already opening if it is the
    // one that warrants it. Shared with the Reinstall action in the engine
    // dialog, which had its own half of this rule and was missing the half
    // that matters.
    const outcome = await startEqualizerApoInstall();
    if (outcome === 'bundle-missing') {
      setStartError(t('prereq.bundleMissing'));
    } else if (outcome === 'not-started') {
      setStartError(t('prereq.notStarted'));
    }
    setIsStarting(false);
  };

  // A declined Windows prompt or an outright failure is an answer, not
  // silence: the banner used to swallow both and just clear `isStarting`,
  // which looked exactly like a button that did nothing.
  const handleInstallFluid = async () => {
    setIsStarting(true);
    setStartError(undefined);
    const result = await onInstallFluid();
    if (!result.ok) {
      setStartError(t(result.declined ? 'engine.declined' : 'engine.failed'));
    }
    setIsStarting(false);
  };

  if (isDismissed) {
    return null;
  }

  const isApo = engine === 'apo';
  const installLabel = isApo
    ? t('prereq.install.apo')
    : t('prereq.install.fluid');

  return (
    <aside className="prereq-notice" role="alert">
      <div className="prereq-notice__copy">
        {/* Naming an engine before the status answer is in would be a guess
            that can name the wrong one's repair, so the title waits with the
            rest of the engine-specific copy below. */}
        {engine && (
          <h2>{isApo ? t('prereq.title.apo') : t('prereq.title.fluid')}</h2>
        )}
        <p>
          {errorMsg} {actionMsg}
        </p>
        {/* The credit is Equalizer APO's licence obligation and its
            explanation of what its setup will ask for. Under the FluidEQ
            Engine neither applies, so only the failure that did happen is
            shown. */}
        {engine && (startError || isApo) && (
          <p className="dependency-credit">
            {startError ??
              t('prereq.credit.apo', {
                product: PRODUCT_NAME,
                author: BUNDLED_ENGINE.author,
              })}
          </p>
        )}
      </div>
      <div className="prereq-notice__actions">
        {/* Loud, and the only loud one here: installing the missing piece is
            the way out of this notice. Retry and Dismiss used to wear the same
            filled accent, which made three equal-looking buttons out of one
            recommendation and two ways of putting it off. */}
        {engine && (
          <Button
            ariaLabel={installLabel}
            isDisabled={isLoading || isStarting}
            className="default"
            handleChange={isApo ? handleInstallApo : handleInstallFluid}
          >
            {isStarting ? t('prereq.starting') : installLabel}
          </Button>
        )}
        <Button
          ariaLabel={t('prereq.retry')}
          isDisabled={isLoading}
          className="default subtle"
          handleChange={onRetry}
        >
          {t('prereq.retry')}
        </Button>
        <Button
          ariaLabel={t('prereq.dismiss')}
          isDisabled={false}
          className="default subtle"
          handleChange={() => setIsDismissed(true)}
        >
          {t('prereq.dismiss')}
        </Button>
      </div>
    </aside>
  );
}
