/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { ErrorDescription } from 'common/errors';
import { useCallback } from 'react';
import {
  disableAutoPreAmp,
  enableAutoPreAmp,
  setSmartHeadroom,
} from '../utils/equalizerApi';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import Button from '../widgets/Button';

/**
 * Three positions of one control, because there is one number in question.
 *
 * Off hands the preamp to the user. Normalize reserves what the chain could
 * theoretically need. Smart reserves what the music actually needs, measured.
 * Two switches for one value would be two things to reason about before knowing
 * how loud the output is; a row of three says the whole state at a glance, and
 * the filled button among two quiet ones already says which is chosen.
 *
 * Replaces `AutoPreAmpEnablerSwitch`, whose two positions are the first two of
 * these.
 */
type TMode = 'off' | 'normalize' | 'smart';

interface IAutoNormalizeModeControlProps {
  id: string;
}

export default function AutoNormalizeModeControl({
  id,
}: IAutoNormalizeModeControlProps) {
  const { t } = useTranslation();
  const {
    isBlockingError,
    isAutoPreAmpOn,
    isSmartHeadroomOn,
    setGlobalError,
    setAutoPreAmpOn,
    setSmartHeadroomOn,
    setPreAmp,
  } = useFluidEqContext();

  const mode: TMode = (() => {
    if (!isAutoPreAmpOn) {
      return 'off';
    }
    return isSmartHeadroomOn ? 'smart' : 'normalize';
  })();

  const selectMode = useCallback(
    (next: TMode) => async () => {
      if (next === mode) {
        return;
      }
      try {
        /*
         * Smart is switched off BEFORE auto normalize is, and on AFTER it.
         *
         * Both orders write the same two flags, and only one of them is ever
         * asking the resolver a question it can answer. The writer derives the
         * preamp from the pair, and the intermediate state in the wrong order —
         * Smart on with auto normalize off — is a combination that has no
         * meaning, so the number that comes back from it describes nothing and
         * would be published to the slider anyway.
         */
        let applied: number;
        if (next === 'off') {
          if (isSmartHeadroomOn) {
            await setSmartHeadroom(false);
            setSmartHeadroomOn(false);
          }
          applied = await disableAutoPreAmp();
          setAutoPreAmpOn(false);
        } else {
          if (!isAutoPreAmpOn) {
            await enableAutoPreAmp();
            setAutoPreAmpOn(true);
          }
          applied = await setSmartHeadroom(next === 'smart');
          setSmartHeadroomOn(next === 'smart');
        }
        setPreAmp(applied);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [
      isAutoPreAmpOn,
      isSmartHeadroomOn,
      mode,
      setAutoPreAmpOn,
      setGlobalError,
      setPreAmp,
      setSmartHeadroomOn,
    ],
  );

  const options: Array<{ value: TMode; label: string }> = [
    { value: 'off', label: t('sidebar.autoNormalize.off') },
    { value: 'normalize', label: t('sidebar.autoNormalize.on') },
    { value: 'smart', label: t('sidebar.autoNormalize.smart') },
  ];

  return (
    <div
      className="side-bar__mode"
      id={id}
      role="group"
      aria-label={t('sidebar.autoNormalize.aria')}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          ariaLabel={option.label}
          isDisabled={isBlockingError}
          // Each one is a switch rather than an action, so it reports its own
          // state instead of leaving a screen reader to infer the selection
          // from a colour it cannot see.
          isPressed={mode === option.value}
          // `small` is the filled accent and `small subtle` the quiet outline.
          // Emphasis follows the choice that is in force, which is the only
          // recommendation this control has to make.
          className={mode === option.value ? 'small' : 'small subtle'}
          handleChange={selectMode(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
