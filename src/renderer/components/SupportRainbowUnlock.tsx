/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useIsEuphoriaAchieved, winEuphoria } from '../utils/euphoriaMode';
import { useTranslation } from '../utils/I18nContext';

export default function SupportRainbowUnlock({
  hasContributed,
  onContributed,
}: {
  hasContributed: boolean;
  onContributed: () => void;
}) {
  const { t } = useTranslation();
  const isAchieved = useIsEuphoriaAchieved();
  const [isCelebrating, setIsCelebrating] = useState(false);
  // Existing supporters also get the unlock. Once achieved, reopening this
  // dialog must respect their choice to switch Rainbow back off.
  useEffect(() => {
    if (hasContributed && !isAchieved) {
      winEuphoria();
    }
  }, [hasContributed, isAchieved]);

  const confirmContribution = () => {
    // Confirmation used to grant only the badge, leaving Rainbow behind ×10.
    // Unlock on the click; a closing dialog or unfinished animation cannot
    // lose the reward, and no unplayed points are added to the run.
    onContributed();
    winEuphoria();
    setIsCelebrating(true);
  };

  return (
    <>
      {hasContributed ? (
        <p className="support-dialog__thanks">{t('support.thanks')}</p>
      ) : (
        <>
          <button
            type="button"
            className="button small support-dialog__contributed"
            onClick={confirmContribution}
          >
            {t('support.contributed')}
          </button>
          <p className="support-method__hint">{t('support.rainbowHint')}</p>
        </>
      )}
      {isCelebrating &&
        createPortal(
          <div className="support-earn" aria-hidden="true">
            <span
              className="support-earn__core"
              onAnimationEnd={() => setIsCelebrating(false)}
            >
              ★
            </span>
            {Array.from({ length: 12 }, (_value, index) => (
              <span
                key={index}
                className="support-earn__star"
                style={
                  {
                    '--star-angle': `${index * 30}deg`,
                    '--star-delay': `${index * 18}ms`,
                  } as CSSProperties
                }
              >
                ★
              </span>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
