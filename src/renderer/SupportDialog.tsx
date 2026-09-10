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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SUPPORT_CONFIG,
  SupportMethodId,
  getSupportCryptos,
  getSupportMethods,
} from 'common/support';
import { getStreakJoy } from 'common/rhythmGame';
import { isAdBlockRevealChord } from 'common/videoAdBlock';
import { PRODUCT_NAME, PRODUCT_VERSION } from 'common/branding';
import BrandMark from './icons/BrandMark';
import {
  toggleAdBlockRevealed,
  useIsAdBlockRevealed,
} from './utils/adBlockReveal';
import { useIsEuphoric, winEuphoria } from './utils/euphoriaMode';
import { useRhythmRun } from './utils/rhythmRun';
import supportQrImage from '../../assets/support-qr.png';
import MemoryTraceButton from './components/MemoryTraceButton';
import QrCode from './components/QrCode';
import RhythmGame, { IRhythmGameHandle } from './components/RhythmGame';
import SupportRainbowUnlock from './components/SupportRainbowUnlock';
import { SupportPetHero } from './SupportPet';
import { useTranslation } from './utils/I18nContext';
import './styles/Support.scss';

// Webpack substitutes NODE_ENV so the release minifier removes these controls.
const IS_DEV = process.env.NODE_ENV !== 'production';

// Empty outside webpack; the badge must not render as "vundefined" in tests.
const APP_VERSION = PRODUCT_VERSION;

interface ISupportDialogProps {
  hasContributed: boolean;
  onContributed: () => void;
  /** Development reset for the contribution badge and Rainbow unlock. */
  onResetContribution: () => void;
  onClose: () => void;
  /** Open the release notes on top of this dialog. */
  onShowReleaseNotes: () => void;
  /** Stand down while covered so Escape and Tab reach only the top modal. */
  isCovered?: boolean;
}

const COPY_FEEDBACK_MS = 2000;

/** How long the creature keeps the face the last tap earned it. */
const PET_MOOD_MS = 700;

export default function SupportDialog({
  hasContributed,
  onContributed,
  onResetContribution,
  onClose,
  onShowReleaseNotes,
  isCovered = false,
}: ISupportDialogProps) {
  const { t } = useTranslation();
  // Only the dev button below reads this, so that its label says which way it
  // is about to go. The chord deliberately says nothing at all.
  const isAdBlockShown = useIsAdBlockRevealed();
  const methods = getSupportMethods();
  // Read here as well as in the game, because the banner belongs to the panel
  // rather than to the trace — the same one line the titlebar meter uses, so
  // the two cannot disagree about whether the mode is on.
  const isEuphoric = useIsEuphoric(getStreakJoy(useRhythmRun().streak) >= 1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [copiedId, setCopiedId] = useState<SupportMethodId | ''>('');
  // Counted rather than held, because the hop is a CSS animation and the only
  // way to restart one already running is to change its name. Odd and even taps
  // alternate between two identical keyframe sets, so a tap landing mid-hop
  // starts a fresh one instead of being swallowed. Nothing to clean up either —
  // the animation ends by itself.
  const [petTaps, setPetTaps] = useState(0);
  const gameRef = useRef<IRhythmGameHandle>(null);
  // Score at keydown through the ref, not a render later in an effect.
  // The face reacts briefly; the run store keeps the streak across closing.
  const [mood, setMood] = useState<'perfect' | 'miss' | ''>('');
  const moodResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const bouncePet = useCallback(() => {
    setPetTaps((count) => count + 1);
    const result = gameRef.current?.registerTap();
    if (moodResetRef.current !== undefined) {
      clearTimeout(moodResetRef.current);
    }
    if (!result) {
      return;
    }
    if (result.verdict !== 'perfect' && result.verdict !== 'miss') {
      setMood('');
      return;
    }
    setMood(result.verdict);
    moodResetRef.current = setTimeout(() => {
      moodResetRef.current = undefined;
      setMood('');
    }, PET_MOOD_MS);
  }, []);

  useEffect(
    () => () => {
      if (moodResetRef.current !== undefined) {
        clearTimeout(moodResetRef.current);
      }
    },
    [],
  );
  const petHopClass =
    // eslint-disable-next-line no-nested-ternary
    petTaps === 0 ? '' : petTaps % 2 === 1 ? ' is-hopping-a' : ' is-hopping-b';

  useEffect(() => {
    if (isCovered) {
      return undefined;
    }
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      // Ctrl+Shift+Alt+B, and only while this dialog is open.
      //
      // It puts the ad blocker's switch into the video tab's bar, or takes it
      // away again, and says nothing either way — a dialog that announced it
      // would stop the switch being something somebody went looking for, which
      // is the entire reason it is not simply in the interface.
      //
      // Here because this dialog is reachable from anywhere and the player is
      // not: it is only mounted once the video tab has been opened, so the
      // answer lives in a root-level flag that the player reads when it does.
      if (isAdBlockRevealChord(event)) {
        event.preventDefault();
        toggleAdBlockRevealed();
        return;
      }
      // Space plays from the stage or the initially focused close button.
      // Focused payment/unlock controls retain normal keyboard activation.
      const isGameTarget =
        event.target instanceof Element &&
        (event.target.closest('.support-dialog__stage') !== null ||
          event.target === closeRef.current);
      if (event.key === ' ' && isGameTarget) {
        event.preventDefault();
        if (!event.repeat) {
          bouncePet();
        }
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
  }, [bouncePet, isCovered, onClose]);

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
        {/* A real, fixed header rather than three items floating independently
            over the body. It stays outside the scrolling area, so the app
            identity, the active mode and the way out remain available in every
            window size. */}
        <div className="support-dialog__topbar">
          <div className="support-dialog__brand">
            <BrandMark />
            <span>
              {PRODUCT_NAME}
              {APP_VERSION && (
                <span className="support-dialog__version">v{APP_VERSION}</span>
              )}
            </span>
          </div>

          {isEuphoric && (
            <span className="euphoria-pill support-dialog__mode">
              {t('support.game.euphoria')}
            </span>
          )}

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

        {/* Everything that scrolls, which is everything except the way out. */}
        <div className="support-dialog__scroll">
          {/* The creature, her title, and the thing she is jumping. Grouped
              because the two travel together into the left column when the
              panel splits, and the trace has to stay directly under her. */}
          <div className="support-dialog__stage">
            <div className="support-dialog__header">
              <div className="support-dialog__identity">
                <button
                  type="button"
                  className={`support-pet-tap${petHopClass}${mood ? ` is-${mood}` : ''}`}
                  aria-label={t('support.petHint')}
                  // Pointer *down*, not click. A click fires on release, so the
                  // bounce would lag the press by however long the button was
                  // held — useless for tapping in time, and it is meant to feel
                  // identical to hitting space.
                  onPointerDown={bouncePet}
                  // The pointer path never reaches a keyboard user, and space is
                  // handled globally for the whole dialog, so Enter is the only
                  // gap left.
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.repeat) {
                      event.preventDefault();
                      bouncePet();
                    }
                  }}
                >
                  <SupportPetHero hasContributed={hasContributed} />
                </button>
                <div>
                  <span className="eyebrow">{t('support.eyebrow')}</span>
                  <h2 id="support-dialog-title">{t('support.title')}</h2>
                </div>
              </div>
            </div>

            {/* The game used to be hidden behind the contribution flag, so
                nobody could discover the play-to-unlock route before donating. */}
            <RhythmGame ref={gameRef} />
          </div>

          {/* The ask, and the second column when there is one. */}
          <div className="support-dialog__ask">
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

            <SupportRainbowUnlock
              hasContributed={hasContributed}
              onContributed={onContributed}
            />

            <p className="support-dialog__pitch">{t('support.pitch')}</p>

            {/* Said plainly rather than implied. Someone deciding whether to
                contribute is entitled to know what they would be funding, and
                the answer here is one person's attention rather than a
                company's roadmap. */}
            <p className="support-dialog__craft">{t('support.craft')}</p>

            <div className="support-dialog__methods">
              {hasStripe && (
                <a
                  className="support-method support-method--primary"
                  href={SUPPORT_CONFIG.stripeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="support-method__label">
                    {t('support.card')}
                  </span>
                  <span className="support-method__hint">
                    {t('support.card.hint')}
                  </span>
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

            {/* Mac keyboards cannot produce Ctrl+Shift+Alt+B. Development gets
                a button for the same action, independent of the badge.
                Debug-only labels are deliberately untranslated. */}
            {IS_DEV && (
              <div className="support-dialog__dev-row">
                {/* Preview the look without inventing a score or a donation. */}
                <button
                  type="button"
                  className="support-dialog__dev-reset"
                  title="Development build only — switches Rainbow mode on without playing for it"
                  onClick={winEuphoria}
                >
                  dev: rainbow
                </button>
                <button
                  type="button"
                  className="support-dialog__dev-reset"
                  title="Development build only — clears the contributed flag"
                  onClick={onResetContribution}
                >
                  dev: remove badge
                </button>
                <button
                  type="button"
                  className="support-dialog__dev-reset"
                  title="Development build only — shows or hides the ad blocker's switch in the Video tab. Same as Ctrl+Shift+Alt+B."
                  onClick={toggleAdBlockRevealed}
                >
                  {isAdBlockShown
                    ? 'dev: hide ad blocker switch'
                    : 'dev: show ad blocker switch'}
                </button>
                {/* Keep debug tools out of the crowded titlebar. */}
                <MemoryTraceButton />
              </div>
            )}

            {/* Sharing a wrapping row saves height in short windows. */}
            <div className="support-dialog__links">
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
        </div>
      </div>
    </div>
  );
}
