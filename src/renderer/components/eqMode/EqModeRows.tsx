/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TBandQ, TCurveSmoothing } from '../../../common/eqShape';
import type { TEqMode, TEqModeScope } from '../../../common/eqMode';
import { TREBLE_DESIGNS, TTrebleDesign } from '../../../common/filterDesign';
import ProfileActionIcon from '../../icons/ProfileActionIcon';
import { useTranslation } from '../../utils/I18nContext';
import { EQ_MODES, TEqModeChoices, TEqModeRowKind } from './useEqModeChoices';

const qName = (value: TBandQ) => (value === 'off' ? 'constant' : value);

/** What a Treble choice does to a group, said under the row and on hover. */
const trebleNote = (scope: TEqModeScope, value: TTrebleDesign) => {
  if (scope === 'eq') {
    return value === 'precise'
      ? 'eq.mode.trebleEqPrecise'
      : 'eq.mode.trebleEqClassic';
  }
  return value === 'precise'
    ? 'eq.mode.trebleCurvesPrecise'
    : 'eq.mode.trebleCurvesClassic';
};

interface IEqModeRowProps {
  choices: TEqModeChoices;
  scope: TEqModeScope;
  kind: TEqModeRowKind;
}

/** One setting of one group: its name, its choices on one track, its note. */
const EqModeRow = ({ choices, scope, kind }: IEqModeRowProps) => {
  const { t } = useTranslation();
  const { phase, pending, disabled, trebleSupported } = choices;
  const values = {
    strength: EQ_MODES,
    q: ['off', 'proportional', 'asymmetric'] as const,
    smoothing: ['off', 'twelfth', 'third'] as const,
    phase: ['B', 'A'] as const,
    treble: TREBLE_DESIGNS,
  }[kind];
  const current = choices.currentChoice(scope, kind);
  const groupName = t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves');
  const phaseSupported =
    scope === 'eq' ? phase.status?.eqSupported : phase.status?.supported;
  const scopePhaseHint =
    scope === 'eq' ? 'eq.mode.eqPhaseHint' : 'eq.mode.phaseHint';
  const phaseHint = phaseSupported ? scopePhaseHint : 'eq.mode.phaseUpdate';
  const strengthLabel = (mode: TEqMode) => {
    if (mode === 'double') {
      return '×2';
    }
    if (mode === 'studio') {
      return `${t('eq.mode.studio')} · ×1.5`;
    }
    return t('eq.mode.normal');
  };
  return (
    <div className={`eq-mode-choices__row eq-mode-choices__row--${kind}`}>
      <span className="eq-mode-choices__label">{t(`eq.mode.${kind}`)}</span>
      <div
        className="segmented eq-mode-choices__track"
        role="group"
        aria-label={
          kind === 'strength'
            ? groupName
            : `${groupName} · ${t(`eq.mode.${kind}`)}`
        }
      >
        {values.map((value) => {
          const isPending = pending === `${scope}-${kind}-${value}`;
          let text: string;
          let hint: string | undefined;
          if (kind === 'phase') {
            text = t(
              value === 'B' ? 'eq.mode.minimumPhase' : 'eq.mode.linearPhase',
            );
            hint = t(phaseHint);
          } else if (kind === 'treble') {
            text = t(
              value === 'precise' ? 'eq.mode.precise' : 'eq.mode.classic',
            );
            hint = t(trebleNote(scope, value as TTrebleDesign));
          } else if (kind === 'q') {
            text = t(`eq.mode.${qName(value as TBandQ)}`);
            hint = t(`eq.mode.${qName(value as TBandQ)}Hint`);
          } else if (kind === 'strength') {
            text = strengthLabel(value as TEqMode);
          } else {
            text = t(`eq.mode.${value as TCurveSmoothing}`);
          }
          return (
            <button
              type="button"
              key={value}
              className={`segmented__option eq-mode-choice${
                current === value ? ' is-selected' : ''
              }`}
              aria-pressed={current === value}
              aria-busy={isPending}
              disabled={
                disabled ||
                (kind === 'phase' && !phaseSupported) ||
                (kind === 'treble' && !trebleSupported)
              }
              onClick={() => choices.select(scope, value, kind)}
              title={hint}
            >
              <span className="eq-mode-choice__label">
                {isPending && (
                  <span className="eq-mode-choice__pending" aria-hidden />
                )}
                {text}
              </span>
              {kind === 'phase' &&
                value === 'A' &&
                phaseSupported &&
                phase.status?.bandPhaseScopes && (
                  <small className="eq-mode-choice__delay">
                    {choices.linearDelayLabel(
                      scope,
                      phase.status.bandPhaseScopes,
                    )}
                  </small>
                )}
            </button>
          );
        })}
      </div>
      {kind === 'phase' && (
        <p className="eq-mode-choices__note">{t(phaseHint)}</p>
      )}
      {kind === 'q' && scope === 'eq' && (
        <p className="eq-mode-choices__note">{t('eq.mode.mainQHint')}</p>
      )}
      {kind === 'treble' && (
        <p className="eq-mode-choices__note">
          {t(
            trebleSupported
              ? trebleNote(scope, choices.trebleOf(scope))
              : 'eq.mode.trebleUpdate',
          )}
        </p>
      )}
    </div>
  );
};

/**
 * A group's settings, in the order the menu and the pinned card both show
 * them. Phase and Treble only where the engine plays a choice of them, and
 * Smoothing only for the curves: it smooths a sampled curve, and the bands
 * are not sampled.
 */
export const EqModeRows = ({
  choices,
  scope,
}: {
  choices: TEqModeChoices;
  scope: TEqModeScope;
}) => (
  <>
    <EqModeRow choices={choices} scope={scope} kind="strength" />
    <EqModeRow choices={choices} scope={scope} kind="q" />
    {choices.phase.status?.active && (
      <EqModeRow choices={choices} scope={scope} kind="phase" />
    )}
    {choices.trebleShown && (
      <EqModeRow choices={choices} scope={scope} kind="treble" />
    )}
    {scope === 'curves' && (
      <EqModeRow choices={choices} scope={scope} kind="smoothing" />
    )}
  </>
);

/** Every setting of both groups back to where a new install starts. */
export const EqModeReset = ({ choices }: { choices: TEqModeChoices }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="button small subtle eq-mode-choices__reset"
      disabled={choices.disabled}
      aria-busy={choices.pending === 'eq-reset-normal'}
      onClick={() => choices.select('eq', 'normal', 'reset')}
    >
      <ProfileActionIcon action="restore" />
      {t('eq.mode.reset')}
    </button>
  );
};
