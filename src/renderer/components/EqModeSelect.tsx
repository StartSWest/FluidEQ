import { useEffect, useRef, useState } from 'react';
import { TBandQ, TCurveSmoothing } from '../../common/eqShape';
import {
  DEFAULT_CURVE_COMPARISON,
  TCurveComparison,
} from '../../common/curveComparison';
import EqModeIcon from '../icons/EqModeIcon';
import ProfileActionIcon from '../icons/ProfileActionIcon';
import {
  getEqMode,
  getBandQ,
  getCurveEqMode,
  TEqMode,
  TEqModeScope,
} from '../../common/eqMode';
import { ErrorDescription } from '../../common/errors';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { resetEqMode, setEqMode, setEqShape } from '../utils/equalizerApi';
import AnchoredMenu from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import Chevron from '../icons/Chevron';
// The segmented track every closed set of choices in the app is drawn on.
import '../styles/Dsp.scss';
import '../styles/EqModeSelect.scss';
import useCurvePhase from '../utils/useCurvePhase';
import { useListenedOutput } from '../utils/useListenedOutput';
import {
  engineSharesLinearDelay,
  linearPhaseAddedMs,
} from '../../common/linearPhaseDelay';
import {
  DEFAULT_TREBLE_DESIGN,
  engineTakesTrebleChoice,
  groupPlaysMatched,
  TREBLE_DESIGNS,
  TTrebleDesign,
} from '../../common/filterDesign';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import {
  selectTrebleDesign,
  useTrebleDesigns,
} from '../utils/useTrebleDesigns';

const MODES: TEqMode[] = ['normal', 'studio', 'double'];
const SCOPES: TEqModeScope[] = ['eq', 'curves'];
const qName = (value: TBandQ) => (value === 'off' ? 'constant' : value);
type ChoiceKind = 'strength' | 'q' | 'smoothing' | 'phase' | 'treble' | 'reset';
type ChoiceValue =
  TEqMode | TBandQ | TCurveSmoothing | TCurveComparison | TTrebleDesign;

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
interface IPendingChoice {
  scope: TEqModeScope;
  value: ChoiceValue;
  kind: ChoiceKind;
}

export default function EqModeSelect() {
  const { t } = useTranslation();
  const state = useFluidEqContext();
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
  const listened = useListenedOutput(Boolean(phase.status?.active));
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
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const queued = useRef(new Map<string, IPendingChoice>());
  const [pending, setPending] = useState<string>();
  const anchor = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const selected = { eq: getEqMode(state), curves: getCurveEqMode(state) };
  const customized =
    SCOPES.some(
      (scope) =>
        selected[scope] !== 'normal' || getBandQ(state, scope) !== 'off',
    ) ||
    (state.curveSmoothing !== undefined && state.curveSmoothing !== 'off') ||
    (phase.status?.active &&
      (phase.status.variant !== DEFAULT_CURVE_COMPARISON ||
        phase.status.eqVariant !== DEFAULT_CURVE_COMPARISON)) ||
    (trebleSupported &&
      SCOPES.some((scope) => trebleOf(scope) !== DEFAULT_TREBLE_DESIGN));
  const summary = t(customized ? 'eq.mode.customized' : 'eq.mode.normal');
  const disabled = state.isBlockingError;
  const label = (mode: TEqMode) => {
    if (mode === 'double') {
      return '×2';
    }
    if (mode === 'studio') {
      return `${t('eq.mode.studio')} · ×1.5`;
    }
    return t('eq.mode.normal');
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (
        !anchor.current?.contains(target) &&
        !content.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        anchor.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  const currentChoice = (
    scope: TEqModeScope,
    kind: Exclude<ChoiceKind, 'reset'>,
  ) => {
    if (kind === 'strength') {
      return selected[scope];
    }
    if (kind === 'q') {
      return getBandQ(state, scope);
    }
    if (kind === 'phase') {
      return scope === 'eq' ? phase.status?.eqVariant : phase.status?.variant;
    }
    if (kind === 'treble') {
      return trebleOf(scope);
    }
    return state.curveSmoothing ?? 'off';
  };

  const select = async (
    scope: TEqModeScope,
    value: ChoiceValue,
    kind: ChoiceKind = 'strength',
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

  const choices = (scope: TEqModeScope, kind: Exclude<ChoiceKind, 'reset'>) => {
    const values = {
      strength: MODES,
      q: ['off', 'proportional', 'asymmetric'] as const,
      smoothing: ['off', 'twelfth', 'third'] as const,
      phase: ['B', 'A'] as const,
      treble: TREBLE_DESIGNS,
    }[kind];
    const current = currentChoice(scope, kind);
    const phaseSupported =
      scope === 'eq' ? phase.status?.eqSupported : phase.status?.supported;
    const scopePhaseHint =
      scope === 'eq' ? 'eq.mode.eqPhaseHint' : 'eq.mode.phaseHint';
    const phaseHint = phaseSupported ? scopePhaseHint : 'eq.mode.phaseUpdate';
    return (
      <div className="eq-mode-menu__row">
        <span className="eq-mode-menu__row-label">{t(`eq.mode.${kind}`)}</span>
        <div
          className="segmented eq-mode-menu__choices"
          role="group"
          aria-label={
            kind === 'strength'
              ? t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')
              : `${t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')} · ${t(`eq.mode.${kind}`)}`
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
              text = label(value as TEqMode);
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
                onClick={() => select(scope, value, kind)}
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
                      {linearDelayLabel(scope, phase.status.bandPhaseScopes)}
                    </small>
                  )}
              </button>
            );
          })}
        </div>
        {kind === 'phase' && (
          <p className="eq-mode-menu__note">{t(phaseHint)}</p>
        )}
        {kind === 'treble' && (
          <p className="eq-mode-menu__note">
            {t(
              trebleSupported
                ? trebleNote(scope, trebleOf(scope))
                : 'eq.mode.trebleUpdate',
            )}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="eq-toolbar__option" aria-busy={isSaving}>
      <button
        ref={anchor}
        type="button"
        className="eq-mode-trigger"
        aria-label={t('eq.mode')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={state.isBlockingError}
        onClick={() => setIsOpen((open) => !open)}
      >
        {/* Named by a glyph as well as by a word, like every other control
            in these toolbars — and it is the glyph that is left once the row
            runs out of room for words (Ivan, 2026-09-22). */}
        <MenuIcon name="settings" className="eq-toolbar__icon" />
        <span>{t('eq.mode')}</span>
        <span className="eq-mode-trigger__summary">{summary}</span>
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={anchor.current}
        isOpen={isOpen}
        className="eq-mode-menu"
        role="dialog"
        ariaLabel={t('eq.mode')}
      >
        <div ref={content} className="eq-mode-menu__content">
          <div className="eq-mode-menu__heading">
            <span>{t('eq.mode')}</span>
            <button
              type="button"
              className="button small subtle eq-mode-menu__reset"
              disabled={disabled}
              aria-busy={pending === 'eq-reset-normal'}
              onClick={() => select('eq', 'normal', 'reset')}
            >
              <ProfileActionIcon action="restore" />
              {t('eq.mode.reset')}
            </button>
          </div>
          {SCOPES.map((scope) => (
            <section className="eq-mode-menu__group" key={scope}>
              <strong className="eq-mode-menu__group-title">
                <EqModeIcon kind={scope} />
                {t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')}
              </strong>
              {choices(scope, 'strength')}
              {choices(scope, 'q')}
              {scope === 'curves' && choices(scope, 'smoothing')}
              {phase.status?.active && choices(scope, 'phase')}
              {trebleShown && choices(scope, 'treble')}
            </section>
          ))}
          <p className="eq-mode-menu__note">{t('eq.mode.shapeHint')}</p>
        </div>
      </AnchoredMenu>
    </div>
  );
}
