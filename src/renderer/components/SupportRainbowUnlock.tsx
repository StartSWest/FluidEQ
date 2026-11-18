/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

export default function SupportRainbowUnlock({
  hasContributed,
  onContributed,
}: {
  hasContributed: boolean;
  onContributed: () => void;
}) {
  const { t } = useTranslation();
  const [isCelebrating, setIsCelebrating] = useState(false);
  const confirmContribution = () => {
    // On the click, so a closing dialog or an unfinished animation cannot
    // lose the badge, and no unplayed points are added to the run.
    onContributed();
    setIsCelebrating(true);
  };

  return (
    <>
      {hasContributed ? (
        <p className="support-dialog__thanks">{t('support.thanks')}</p>
      ) : (
        <button
          type="button"
          className="button small subtle support-dialog__action"
          onClick={confirmContribution}
        >
          <MenuIcon name="check" />
          {t('support.contributed')}
        </button>
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
