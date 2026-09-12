import { useEffect, useRef, useState } from 'react';
import { TBandQ, TCurveSmoothing } from '../../common/eqShape';
import EqModeIcon from '../icons/EqModeIcon';
import ConfirmIcon from '../icons/ConfirmIcon';
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
import Chevron from '../icons/Chevron';
import '../styles/EqModeSelect.scss';

const MODES: TEqMode[] = ['normal', 'studio', 'double'];
const SCOPES: TEqModeScope[] = ['eq', 'curves'];
const qName = (value: TBandQ) => (value === 'off' ? 'constant' : value);
type ChoiceKind = 'strength' | 'q' | 'smoothing' | 'reset';
interface IPendingChoice {
  scope: TEqModeScope;
  value: TEqMode | TBandQ | TCurveSmoothing;
  kind: ChoiceKind;
}

export default function EqModeSelect() {
  const { t } = useTranslation();
  const state = useFluidEqContext();
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
    (state.curveSmoothing !== undefined && state.curveSmoothing !== 'off');
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
    kind: 'strength' | 'q' | 'smoothing',
  ) => {
    if (kind === 'strength') {
      return selected[scope];
    }
    if (kind === 'q') {
      return getBandQ(state, scope);
    }
    return state.curveSmoothing ?? 'off';
  };

  const select = async (
    scope: TEqModeScope,
    value: TEqMode | TBandQ | TCurveSmoothing,
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

  const choices = (
    scope: TEqModeScope,
    kind: 'strength' | 'q' | 'smoothing',
  ) => {
    const values = {
      strength: MODES,
      q: ['off', 'proportional', 'asymmetric'] as const,
      smoothing: ['off', 'twelfth', 'third'] as const,
    }[kind];
    const current = currentChoice(scope, kind);
    return (
      <div className="eq-mode-menu__row">
        <span className="eq-mode-menu__row-label">{t(`eq.mode.${kind}`)}</span>
        <div
          className="eq-mode-menu__choices"
          role="group"
          aria-label={
            kind === 'strength'
              ? t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')
              : `${t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')} · ${t(`eq.mode.${kind}`)}`
          }
        >
          {values.map((value) => {
            const isPending = pending === `${scope}-${kind}-${value}`;
            return (
              <button
                type="button"
                key={value}
                className="button small subtle eq-mode-choice"
                aria-pressed={current === value}
                aria-busy={isPending}
                disabled={disabled}
                onClick={() => select(scope, value, kind)}
                title={
                  kind === 'q'
                    ? t(`eq.mode.${qName(value as TBandQ)}Hint`)
                    : undefined
                }
              >
                <EqModeIcon
                  kind={kind === 'q' ? qName(value as TBandQ) : value}
                />
                <span>
                  {kind === 'strength'
                    ? label(value as TEqMode)
                    : t(
                        `eq.mode.${kind === 'q' ? qName(value as TBandQ) : (value as TCurveSmoothing)}`,
                      )}
                </span>
                <span className="eq-mode-choice__mark" aria-hidden="true">
                  {isPending && <span className="eq-mode-choice__pending" />}
                  {!isPending && current === value && (
                    <ConfirmIcon variant="accept" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
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
            </section>
          ))}
          <p className="eq-mode-menu__note">{t('eq.mode.shapeHint')}</p>
        </div>
      </AnchoredMenu>
    </div>
  );
}
