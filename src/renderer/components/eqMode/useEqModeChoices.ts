/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import {
  curveSmoothingOf,
  DEFAULT_CURVE_SMOOTHING,
  TBandQ,
  TCurveSmoothing,
} from '../../../common/eqShape';
import {
  DEFAULT_CURVE_COMPARISON,
  TCurveComparison,
} from '../../../common/curveComparison';
import {
  getEqMode,
  getBandQ,
  getMainBandQ,
  getCurveEqMode,
  TEqMode,
  TEqModeScope,
} from '../../../common/eqMode';
import { ErrorDescription } from '../../../common/errors';
import {
  engineSharesLinearDelay,
  linearPhaseAddedMs,
} from '../../../common/linearPhaseDelay';
import {
  DEFAULT_TREBLE_DESIGN,
  engineTakesTrebleChoice,
  groupPlaysMatched,
  TTrebleDesign,
} from '../../../common/filterDesign';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import { resetEqMode, setEqMode, setEqShape } from '../../utils/equalizerApi';
import useCurvePhase from '../../utils/useCurvePhase';
import { useListenedOutput } from '../../utils/useListenedOutput';
import { useKnownAudioEngineStatus } from '../../utils/useAudioEngineStatus';
import {
  selectTrebleDesign,
  useTrebleDesigns,
} from '../../utils/useTrebleDesigns';

export const EQ_MODES: TEqMode[] = ['normal', 'studio', 'double'];
export const EQ_MODE_SCOPES: TEqModeScope[] = ['eq', 'curves'];
export type TEqModeChoiceKind =
  'strength' | 'q' | 'smoothing' | 'phase' | 'treble' | 'reset';
export type TEqModeRowKind = Exclude<TEqModeChoiceKind, 'reset'>;
export type TEqModeChoiceValue =
  TEqMode | TBandQ | TCurveSmoothing | TCurveComparison | TTrebleDesign;

interface IPendingChoice {
  scope: TEqModeScope;
  value: TEqModeChoiceValue;
  kind: TEqModeChoiceKind;
}

/**
 * Everything the EQ mode menu shows and does, for each place it is shown:
 * the menu under the toolbar's EQ mode button, and the card it becomes when
 * pinned beside the graph (`EqModeCard`). One mounted at a time edits; the
 * choices queue here, one write after another, so a fast run of presses
 * lands in order and the last one wins.
 */
const useEqModeChoices = () => {
  const { t } = useTranslation();
  const state = useFluidEqLayers();
  const phase = useCurvePhase();
  const engineStatus = useKnownAudioEngineStatus();
  const treble = useTrebleDesigns();
  // The FluidEQ Engine's row: Equalizer APO has only the cookbook.
  const trebleShown =
    engineStatus?.engine === 'fluid' && engineStatus.fluid.installed;
  const engineVersion = engineStatus?.fluid.dllVersion;
  const trebleSupported = trebleShown && engineTakesTrebleChoice(engineVersion);
  // What a group plays: its choice, on an engine that reads one; on an older
  // engine what that engine always plays, shown as it is rather than chosen.
  const trebleOf = (scope: TEqModeScope): TTrebleDesign => {
    if (trebleSupported) {
      return treble?.[scope] ?? DEFAULT_TREBLE_DESIGN;
    }
    return groupPlaysMatched(engineVersion, DEFAULT_TREBLE_DESIGN)
      ? 'precise'
      : 'classic';
  };
  const listened = useListenedOutput(Boolean(phase.status?.active), 'editor');
  const phaseRate = listened.output?.latency?.rate ?? 48000;
  // What Linear costs a group, under the word. On an engine that builds every
  // layer in linear phase into one FIR, a group joining the other's linear
  // bands costs nothing more: the delay is shared.
  const linearDelayLabel = (
    scope: TEqModeScope,
    scopes: Readonly<Record<TEqModeScope, boolean>>,
  ) => {
    if (listened.output?.gameMode) {
      return t('eq.mode.gameMinimum');
    }
    const other: TEqModeScope = scope === 'eq' ? 'curves' : 'eq';
    const otherVariant =
      other === 'eq' ? phase.status?.eqVariant : phase.status?.variant;
    if (
      engineSharesLinearDelay(engineVersion) &&
      otherVariant === 'A' &&
      scopes[other]
    ) {
      return t('eq.mode.linearDelayShared', {
        ms: String(Math.round(linearPhaseAddedMs(phaseRate, true))),
      });
    }
    return t(
      scope === 'eq' && !scopes.eq
        ? 'eq.mode.linearDelayInactive'
        : 'eq.mode.linearDelay',
      {
        ms: String(
          Math.round(
            linearPhaseAddedMs(phaseRate, scope === 'eq' || scopes[scope]),
          ),
        ),
      },
    );
  };
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const queued = useRef(new Map<string, IPendingChoice>());
  const [pending, setPending] = useState<string>();
  const selected = { eq: getEqMode(state), curves: getCurveEqMode(state) };
  const bandQ = (scope: TEqModeScope) =>
    scope === 'eq' ? getMainBandQ(state) : getBandQ(state, scope);
  const customized = Boolean(
    EQ_MODE_SCOPES.some(
      (scope) => selected[scope] !== 'normal' || bandQ(scope) !== 'off',
    ) ||
    curveSmoothingOf(state.curveSmoothing) !== DEFAULT_CURVE_SMOOTHING ||
    (phase.status?.active &&
      (phase.status.variant !== DEFAULT_CURVE_COMPARISON ||
        phase.status.eqVariant !== DEFAULT_CURVE_COMPARISON)) ||
    (trebleSupported &&
      EQ_MODE_SCOPES.some(
        (scope) => trebleOf(scope) !== DEFAULT_TREBLE_DESIGN,
      )),
  );
  const disabled = state.isBlockingError;

  const currentChoice = (scope: TEqModeScope, kind: TEqModeRowKind) => {
    if (kind === 'strength') {
      return selected[scope];
    }
    if (kind === 'q') {
      return bandQ(scope);
    }
    if (kind === 'phase') {
      return scope === 'eq' ? phase.status?.eqVariant : phase.status?.variant;
    }
    if (kind === 'treble') {
      return trebleOf(scope);
    }
    return curveSmoothingOf(state.curveSmoothing);
  };

  const select = async (
    scope: TEqModeScope,
    value: TEqModeChoiceValue,
    kind: TEqModeChoiceKind = 'strength',
  ) => {
    const current = kind === 'reset' ? undefined : currentChoice(scope, kind);
    if (state.isBlockingError || (!saving.current && current === value)) {
      return;
    }
    if (kind === 'reset') {
      queued.current.clear();
    }
    queued.current.set(`${scope}-${kind}`, { scope, value, kind });
    if (saving.current) {
      return;
    }
    saving.current = true;
    setIsSaving(true);
    const applyNext = async (): Promise<void> => {
      const next = queued.current.entries().next().value;
      if (!next) {
        return;
      }
      const [key, choice] = next;
      queued.current.delete(key);
      setPending(`${choice.scope}-${choice.kind}-${choice.value}`);
      try {
        if (choice.kind === 'reset') {
          await resetEqMode();
          if (phase.status?.active && phase.status.supported) {
            await phase.select(DEFAULT_CURVE_COMPARISON, 'curves');
          }
          if (phase.status?.active && phase.status.eqSupported) {
            await phase.select(DEFAULT_CURVE_COMPARISON, 'eq');
          }
          // One after the other: each answer reads both files back, and a
          // read that overtook the other write would show it undone.
          if (trebleSupported && trebleOf('eq') !== DEFAULT_TREBLE_DESIGN) {
            await selectTrebleDesign(DEFAULT_TREBLE_DESIGN, 'eq');
          }
          if (trebleSupported && trebleOf('curves') !== DEFAULT_TREBLE_DESIGN) {
            await selectTrebleDesign(DEFAULT_TREBLE_DESIGN, 'curves');
          }
        } else if (choice.kind === 'phase') {
          await phase.select(choice.value as TCurveComparison, choice.scope);
        } else if (choice.kind === 'treble') {
          await selectTrebleDesign(choice.value as TTrebleDesign, choice.scope);
        } else if (choice.kind === 'strength') {
          await setEqMode(choice.value as TEqMode, choice.scope);
        } else {
          await setEqShape(
            choice.scope,
            choice.kind,
            choice.value as TBandQ | TCurveSmoothing,
          );
        }
        await state.refreshState();
      } catch (error) {
        state.setGlobalError(error as ErrorDescription);
      }
      await applyNext();
    };
    try {
      await applyNext();
    } finally {
      saving.current = false;
      setIsSaving(false);
      setPending(undefined);
    }
  };

  return {
    state,
    phase,
    customized,
    disabled,
    trebleShown,
    trebleSupported,
    trebleOf,
    linearDelayLabel,
    currentChoice,
    select,
    pending,
    isSaving,
  };
};

export type TEqModeChoices = ReturnType<typeof useEqModeChoices>;

export default useEqModeChoices;
