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
  SupportMethodId,
  getSupportCryptos,
  getSupportMethods,
} from 'common/support';
import supportQrImage from '../../assets/support-qr.png';
import QrCode from './components/QrCode';
import { SupportPetHero } from './SupportPet';
import { useTranslation } from './utils/I18nContext';
import './styles/Support.scss';

interface ISupportDialogProps {
  hasContributed: boolean;
  onContributed: () => void;
  onClose: () => void;
  /** Swap this dialog for the release notes. */
  onShowReleaseNotes: () => void;
}

const COPY_FEEDBACK_MS = 2000;

export default function SupportDialog({
  hasContributed,
  onContributed,
  onClose,
  onShowReleaseNotes,
}: ISupportDialogProps) {
  const { t } = useTranslation();
  const methods = getSupportMethods();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [copiedId, setCopiedId] = useState<SupportMethodId | ''>('');

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

  const handleCopyAddress = async (id: SupportMethodId, address: string) => {
    if (copyResetRef.current !== undefined) {
      clearTimeout(copyResetRef.current);
    }
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
    } catch {
      // Clipboard permission can be refused; the address stays selectable so
      // the donor is never stuck.
      setCopiedId('');
    }
    copyResetRef.current = setTimeout(() => setCopiedId(''), COPY_FEEDBACK_MS);
  };

  const hasStripe = methods.some((method) => method.id === 'stripe');
  const hasCoffee = methods.some((method) => method.id === 'coffee');
  const cryptos = getSupportCryptos();

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
          <div className="support-dialog__identity">
            <SupportPetHero hasContributed={hasContributed} />
            <div>
              <span className="eyebrow">{t('support.eyebrow')}</span>
              <h2 id="support-dialog-title">{t('support.title')}</h2>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="support-dialog__close"
            aria-label={t('support.close')}
            onClick={onClose}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <p className="support-dialog__pitch">{t('support.pitch')}</p>

        {/* Said plainly rather than implied. Someone deciding whether to
            contribute is entitled to know what they would be funding, and the
            answer here is one person's attention rather than a company's
            roadmap. */}
        <p className="support-dialog__craft">{t('support.craft')}</p>

        <div className="support-dialog__methods">
          {hasStripe && (
            <a
              className="support-method support-method--primary"
              href={SUPPORT_CONFIG.stripeUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="support-method__label">{t('support.card')}</span>
              <span className="support-method__hint">
                {t('support.card.hint')}
              </span>
            </a>
          )}

          {hasCoffee && (
            <a
              className="support-method support-method--primary support-method--qr"
              href={SUPPORT_CONFIG.coffeeUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <div className="support-method__text">
                <span className="support-method__label">
                  {t('support.coffee')}
                </span>
                <span className="support-method__hint">
                  {t('support.coffee.hint')}
                </span>
              </div>
              {/* The artwork ships with the app rather than being generated,
                  so the branded code from Buy Me a Coffee is what people scan.
                  It is therefore pinned to whatever page it was made for — if
                  FLUIDEQ_COFFEE_URL ever changes, replace this file too. */}
              <img
                className="qr-code"
                src={supportQrImage}
                alt="QR code for the Buy me a coffee page"
                width={168}
                height={168}
              />
            </a>
          )}

          {cryptos.map(({ asset, address, uri }) => (
            <div
              className={`support-method${uri ? ' support-method--qr' : ''}`}
              key={asset.id}
            >
              <div className="support-method__text">
                <span className="support-method__label">
                  {asset.name}
                  <em>{asset.symbol}</em>
                </span>
                {/* The network is called out because several of these share an
                    address format, and sending on the wrong one loses the
                    funds with no way to recover them. */}
                <span className="support-method__hint">
                  {asset.network}. {t('support.verify')}
                </span>
              </div>
              {/* Scanning the URI beats retyping 40-odd characters, and the
                  code is generated from the same string shown below it. */}
              {uri && (
                <QrCode
                  value={uri}
                  label={`QR code for the ${asset.name} address`}
                  size={168}
                />
              )}
              <code className="support-method__address">{address}</code>
              <div className="support-method__actions">
                <button
                  type="button"
                  className="support-method__action"
                  onClick={() => handleCopyAddress(asset.id, address)}
                >
                  {copiedId === asset.id
                    ? t('support.copied')
                    : t('support.copy')}
                </button>
                {uri && (
                  <a
                    className="support-method__action"
                    href={uri}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('support.openWallet')}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Self-declared, and honest about it: the app cannot see a Payment
            Link checkout or an on-chain transfer, so this is the user telling
            us. It only ever adds something, which is why an unverifiable
            claim is harmless here. */}
        {hasContributed ? (
          <p className="support-dialog__thanks">{t('support.thanks')}</p>
        ) : (
          <button
            type="button"
            className="support-dialog__contributed"
            onClick={onContributed}
          >
            {t('support.contributed')}
          </button>
        )}

        {/* What the last version changed, one click away. Someone weighing
            up a contribution is entitled to see what the money has been
            producing. */}
        <button
          type="button"
          className="support-dialog__notes"
          onClick={onShowReleaseNotes}
        >
          {t('support.releaseNotes')}
        </button>

        <p className="support-dialog__footer">
          {t('support.footerBefore')}{' '}
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
