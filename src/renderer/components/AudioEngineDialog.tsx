/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The one place the audio engine is chosen.
 *
 * Two radios and nothing else: the EQ page and the DSP page are unchanged by
 * this feature, and the three Equalizer APO repairs that used to sit loose in
 * the actions menu now live inside the APO card here — they are meaningless
 * under the FluidEQ Engine, and a menu that offers them anyway reads as three
 * broken items rather than as one engine not being in use.
 *
 * The same component is the blocking first run. `onCancel` absent means there
 * is no engine chosen yet: no Cancel button, and Escape does nothing, because
 * there is nothing behind the dialog that works.
 */

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IAudioEngineStatus, TAudioEngine } from 'common/audioEngine';
import { useTranslation } from '../utils/I18nContext';
// The footer and the APO repairs are raw `<button class="button">`s rather
// than the `Button` widget — they are native buttons in a focus trap — so the
// sheet that defines that class has to be asked for here. It used to be
// reached only because some `Button` widget happened to be mounted elsewhere
// on the page, which is the accident `.link-button` was moved to fix.
import '../styles/Button.scss';
import '../styles/AudioEngineDialog.scss';

export type TApoAction = 'reconfigure' | 'settings' | 'reinstall';

export interface IAudioEngineDialogProps {
  status: IAudioEngineStatus;
  onApply: (engine: TAudioEngine) => Promise<void>;
  /** Absent = the blocking first run: no Cancel, and Escape does nothing. */
  onCancel?: () => void;
  /** Rendered only while Equalizer APO is the engine in use. */
  onApoAction?: (action: TApoAction) => void;
}

/**
 * A tick or a dash beside each line.
 *
 * Stroked rather than a text glyph: "✓" and "–" come from whichever font the
 * platform happens to have them in, so the same two marks were three
 * different weights and two different heights across Windows, macOS and
 * Ubuntu. These are the same shape everywhere and take their colour from the
 * line they belong to.
 */
const Mark = ({ kind }: { kind: 'yes' | 'no' }) => (
  <svg
    className={`engine-dialog__mark engine-dialog__mark--${kind}`}
    viewBox="0 0 14 14"
    aria-hidden="true"
  >
    {kind === 'yes' ? (
      <path d="M2.6 7.3l2.9 2.9L11.4 4" />
    ) : (
      <path d="M3.2 7h7.6" />
    )}
  </svg>
);

interface IEngineOptionProps {
  name: string;
  lines: readonly (readonly [string, 'yes' | 'no'])[];
  isChecked: boolean;
  isDisabled: boolean;
  recommended?: string;
  onSelect: () => void;
  /** Arrow keys, handled here rather than on the group: the group is not a
   * focusable element, so a listener on it only ever fires by bubbling from
   * one of these — and a role that receives keys has to be reachable. */
  onNavigate: (event: KeyboardEvent<HTMLDivElement>) => void;
  optionRef: (element: HTMLDivElement | null) => void;
}

const EngineOption = ({
  name,
  lines,
  isChecked,
  isDisabled,
  recommended,
  onSelect,
  onNavigate,
  optionRef,
}: IEngineOptionProps) => (
  <div
    ref={optionRef}
    role="radio"
    aria-checked={isChecked}
    aria-disabled={isDisabled}
    aria-label={name}
    tabIndex={isChecked && !isDisabled ? 0 : -1}
    className="engine-dialog__option"
    onClick={() => {
      if (!isDisabled) {
        onSelect();
      }
    }}
    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
      if (!isDisabled && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onSelect();
        return;
      }
      onNavigate(event);
    }}
  >
    <span className="engine-dialog__radio" aria-hidden="true" />
    <div className="engine-dialog__option-body">
      <div className="engine-dialog__option-head">
        <span className="engine-dialog__name">{name}</span>
        {recommended && (
          <span className="engine-dialog__recommended">{recommended}</span>
        )}
      </div>
      <ul className="engine-dialog__lines">
        {lines.map(([text, kind]) => (
          <li
            key={text}
            className={`engine-dialog__line engine-dialog__line--${kind}`}
          >
            <Mark kind={kind} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const AudioEngineDialog = ({
  status,
  onApply,
  onCancel,
  onApoAction,
}: IAudioEngineDialogProps) => {
  const { t } = useTranslation();
  // The recommendation is the default on a first run; on a machine too old for
  // it, the only thing that can be chosen is the one that is left.
  const [selected, setSelected] = useState<TAudioEngine>(
    status.engine ?? (status.fluidSupported ? 'fluid' : 'apo'),
  );
  const [isApplying, setIsApplying] = useState(false);
  const [failure, setFailure] = useState<'declined' | 'failed' | undefined>();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Applying resolves after a Windows permission prompt, which the dialog may
  // not outlive: the parent closes it on success. Writing state into an
  // unmounted tree is a warning that trains people to ignore warnings.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isBlocking = onCancel === undefined;

  useEffect(() => {
    const previousFocus = document.activeElement;
    // The chosen row, not the first button: this dialog is a question, and the
    // answer already selected is where a keyboard lands.
    const checked = optionRefs.current.find(
      (option) => option?.getAttribute('aria-checked') === 'true',
    );
    checked?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
    // Once, on mount. Re-running it on every selection change would drag focus
    // back out of the footer while somebody was tabbing towards Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onCancel && !isApplying) {
          event.preventDefault();
          onCancel();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        surfaceRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [role="radio"]:not([aria-disabled="true"])',
        ) ?? [],
      );
      if (!focusable.length) {
        return;
      }
      event.preventDefault();
      const current = focusable.findIndex(
        (element) => element === document.activeElement,
      );
      focusable[
        (current + (event.shiftKey ? -1 : 1) + focusable.length) %
          focusable.length
      ]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isApplying, onCancel]);

  const options = useMemo(
    () =>
      [
        {
          engine: 'fluid' as TAudioEngine,
          name: t('engine.fluid.name'),
          recommended: t('engine.recommended'),
          isDisabled: !status.fluidSupported,
          lines: [
            [t('engine.fluid.l1'), 'yes'],
            [t('engine.fluid.l2'), 'yes'],
            [t('engine.fluid.l3'), 'no'],
          ] as const,
        },
        {
          engine: 'apo' as TAudioEngine,
          name: t('engine.apo.name'),
          recommended: undefined,
          isDisabled: false,
          lines: [
            [t('engine.apo.l1'), 'yes'],
            [t('engine.apo.l2'), 'no'],
            [t('engine.apo.l3'), 'no'],
          ] as const,
        },
      ] as const,
    [status.fluidSupported, t],
  );

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      // eslint-disable-next-line no-nested-ternary
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (step === 0 || isApplying) {
      return;
    }
    event.preventDefault();
    const from = options.findIndex((option) => option.engine === selected);
    const count = options.length;
    // Skips over an option the machine cannot run rather than landing on it:
    // an arrow key that selects nothing reads as a dead keyboard.
    for (let hop = 1; hop <= count; hop += 1) {
      const index = (((from + step * hop) % count) + count) % count;
      const next = options[index];
      if (next && !next.isDisabled) {
        setSelected(next.engine);
        optionRefs.current[index]?.focus();
        return;
      }
    }
  };

  const handleApply = async () => {
    if (isApplying) {
      return;
    }
    setIsApplying(true);
    setFailure(undefined);
    try {
      await onApply(selected);
    } catch (error) {
      // "declined" is an answer to a Windows permission prompt, not a fault:
      // it earns a sentence saying nothing changed rather than an error.
      const message = error instanceof Error ? error.message : String(error);
      if (mounted.current) {
        setFailure(message.includes('declined') ? 'declined' : 'failed');
        setIsApplying(false);
      }
      return;
    }
    if (mounted.current) {
      setIsApplying(false);
    }
  };

  const currentName =
    // eslint-disable-next-line no-nested-ternary
    status.engine === 'fluid'
      ? t('engine.fluid.name')
      : status.engine === 'apo'
        ? t('engine.apo.name')
        : undefined;

  return createPortal(
    <div
      className="engine-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && onCancel && !isApplying) {
          onCancel();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="engine-dialog"
        role={isBlocking ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="engine-dialog-title"
        aria-describedby="engine-dialog-subtitle"
      >
        <div className="engine-dialog__head">
          <h2 id="engine-dialog-title" className="engine-dialog__title">
            {t('engine.title')}
          </h2>
          <p id="engine-dialog-subtitle" className="engine-dialog__subtitle">
            {t('engine.subtitle')}
          </p>
        </div>

        <div className="engine-dialog__body">
          <div
            role="radiogroup"
            aria-label={t('engine.title')}
            className="engine-dialog__options"
          >
            {options.map((option, index) => (
              <EngineOption
                key={option.engine}
                name={option.name}
                lines={option.lines}
                recommended={option.recommended}
                isChecked={selected === option.engine}
                isDisabled={option.isDisabled || isApplying}
                onSelect={() => setSelected(option.engine)}
                onNavigate={moveSelection}
                optionRef={(element) => {
                  optionRefs.current[index] = element;
                }}
              />
            ))}
          </div>
          {!status.fluidSupported && (
            <p className="engine-dialog__note">{t('engine.unsupported')}</p>
          )}
          {status.engine === 'apo' && onApoAction && (
            <div className="engine-dialog__apo-actions">
              <button
                type="button"
                className="button small subtle"
                disabled={isApplying}
                onClick={() => onApoAction('reconfigure')}
              >
                {t('engine.apo.reconfigure')}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={isApplying}
                onClick={() => onApoAction('settings')}
              >
                {t('engine.apo.settings')}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={isApplying}
                onClick={() => onApoAction('reinstall')}
              >
                {t('engine.apo.reinstall')}
              </button>
            </div>
          )}
        </div>

        <div className="engine-dialog__foot">
          <div className="engine-dialog__footer">
            {(isApplying || currentName) && (
              <p className="engine-dialog__now">
                {isApplying
                  ? t('engine.installing')
                  : t('engine.now', { engine: currentName ?? '' })}
              </p>
            )}
            <div className="engine-dialog__actions">
              {onCancel && (
                <button
                  type="button"
                  className="button small subtle"
                  disabled={isApplying}
                  onClick={onCancel}
                >
                  {t('engine.cancel')}
                </button>
              )}
              {/* Not disabled while it works: `is-running` is the app's way of
                  saying a button is still doing what it was pressed for, and
                  the rule that draws it refuses a disabled button. Repeated
                  presses are refused by the handler instead. */}
              <button
                type="button"
                className={`button small${isApplying ? ' is-running' : ''}`}
                aria-busy={isApplying}
                disabled={!isApplying && selected === status.engine}
                onClick={handleApply}
              >
                {t('engine.apply')}
              </button>
            </div>
          </div>
          {failure && (
            <p className="engine-dialog__error" role="alert">
              {t(failure === 'declined' ? 'engine.declined' : 'engine.failed')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AudioEngineDialog;
