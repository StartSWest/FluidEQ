/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useEffect, useRef, useState } from 'react';
import {
  SUPPORT_CONFIG,
  getBitcoinUri,
  getSupportMethods,
} from 'common/support';
import './styles/Support.scss';

interface ISupportDialogProps {
  onClose: () => void;
}

const COPY_FEEDBACK_MS = 2000;

export default function SupportDialog({ onClose }: ISupportDialogProps) {
  const methods = getSupportMethods();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      // A modal must not leak focus to the workspace behind it.
      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(
    () => () => {
      if (copyResetRef.current !== undefined) {
        clearTimeout(copyResetRef.current);
      }
    },
    [],
  );

  const handleCopyAddress = async () => {
    if (copyResetRef.current !== undefined) {
      clearTimeout(copyResetRef.current);
    }
    try {
      await navigator.clipboard.writeText(SUPPORT_CONFIG.bitcoinAddress.trim());
      setCopyState('copied');
    } catch {
      // Clipboard permission can be refused; the address stays selectable so
      // the donor is never stuck.
      setCopyState('failed');
    }
    copyResetRef.current = setTimeout(
      () => setCopyState('idle'),
      COPY_FEEDBACK_MS,
    );
  };

  const hasStripe = methods.some((method) => method.id === 'stripe');
  const hasBitcoin = methods.some((method) => method.id === 'bitcoin');
  const bitcoinUri = getBitcoinUri();

  let copyLabel = 'Copy address';
  if (copyState === 'copied') {
    copyLabel = 'Copied';
  } else if (copyState === 'failed') {
    copyLabel = 'Copy failed';
  }

  return (
    <div
      className="support-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="support-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-dialog-title"
      >
        <div className="support-dialog__header">
          <div>
            <span className="eyebrow">ENTIRELY OPTIONAL</span>
            <h2 id="support-dialog-title">Support the work</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="support-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <p className="support-dialog__pitch">
          FluidEQ is free and open source, and it stays that way — nothing here
          is behind a paywall and nothing is ever tracked. If it earned a place
          in your setup, a contribution funds the time that keeps it maintained
          and the next ideas that come out of the same workshop.
        </p>

        <div className="support-dialog__methods">
          {hasStripe && (
            <a
              className="support-method support-method--primary"
              href={SUPPORT_CONFIG.stripeUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="support-method__label">Card or wallet</span>
              <span className="support-method__hint">
                Secure checkout hosted by Stripe. Opens in your browser — the
                app never sees your card details.
              </span>
            </a>
          )}

          {hasBitcoin && (
            <div className="support-method">
              <span className="support-method__label">Bitcoin</span>
              <span className="support-method__hint">
                Send any amount on-chain. Verify the address before sending.
              </span>
              <code className="support-method__address">
                {SUPPORT_CONFIG.bitcoinAddress.trim()}
              </code>
              <div className="support-method__actions">
                <button
                  type="button"
                  className="support-method__action"
                  onClick={handleCopyAddress}
                >
                  {copyLabel}
                </button>
                {bitcoinUri && (
                  <a
                    className="support-method__action"
                    href={bitcoinUri}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open in wallet
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="support-dialog__footer">
          Prefer to contribute time instead? Issues and pull requests are just
          as welcome on{' '}
          <a
            href={SUPPORT_CONFIG.repositoryUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}
