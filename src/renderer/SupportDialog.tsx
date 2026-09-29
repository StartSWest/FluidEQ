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

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  SUPPORT_CONFIG,
  SupportMethodId,
  getSupportCryptos,
  getSupportMethods,
} from 'common/support';
import { isAdBlockRevealChord } from 'common/videoAdBlock';
import { AUTHOR_NAME } from 'common/branding';
import MenuIcon from './icons/MenuIcon';
import {
  toggleAdBlockRevealed,
  useIsAdBlockRevealed,
} from './utils/adBlockReveal';
import { winEuphoria } from './utils/euphoriaMode';
import supportQrImage from '../../assets/support-qr.png';
import DialogFrame from './components/DialogFrame';
import MemoryTraceButton from './components/MemoryTraceButton';
import QrCode from './components/QrCode';
import RhythmGame, { IRhythmGameHandle } from './components/RhythmGame';
import SupportRainbowUnlock from './components/SupportRainbowUnlock';
import { SupportPetHero } from './SupportPet';
import { useTranslation } from './utils/I18nContext';
import isOwnAnimationEnd from './utils/ownAnimationEnd';
import './styles/Support.scss';

// Webpack substitutes NODE_ENV so the release minifier removes these controls.
const IS_DEV = process.env.NODE_ENV !== 'production';

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

/**
 * Asking for support, on the dialog frame (`DialogFrame`).
 *
 * The rail is the pet and her game — what this dialog is, and the one part
 * of it anybody plays with — and the right side is the ask: the ways to give
 * first, then why, in the maker's own words. The way out, the release notes
 * and "I contributed" are the frame's, so none of them scrolls away.
 */
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copiedId, setCopiedId] = useState<SupportMethodId | ''>('');
  // Bumped per copy, so copying again while "Copied" is up holds it for its
  // own full moment rather than for what the last one had left.
  const [copySeq, setCopySeq] = useState(0);
  // Counted rather than held, because the hop is a CSS animation and the only
  // way to restart one already running is to change its name. Odd and even taps
  // alternate between two identical keyframe sets, so a tap landing mid-hop
  // starts a fresh one instead of being swallowed. Nothing to clean up either —
  // the animation ends by itself.
  const [petTaps, setPetTaps] = useState(0);
  const gameRef = useRef<IRhythmGameHandle>(null);
  // Score at keydown through the ref, not a render later in an effect.
  // The face reacts briefly; the run store keeps the streak across closing.
  // How long she keeps it is the hold on the mark inside her button
  // (`support-pet-mood` in `Support.scss`), whose end clears it.
  const [mood, setMood] = useState<'perfect' | 'miss' | ''>('');
  const bouncePet = useCallback(() => {
    setPetTaps((count) => count + 1);
    const result = gameRef.current?.registerTap();
    if (!result) {
      return;
    }
    if (result.verdict !== 'perfect' && result.verdict !== 'miss') {
      setMood('');
      return;
    }
    setMood(result.verdict);
  }, []);
  const petHopClass =
    // eslint-disable-next-line no-nested-ternary -- still, then the two hop classes taking turns so a tap mid-hop restarts it
    petTaps === 0 ? '' : petTaps % 2 === 1 ? ' is-hopping-a' : ' is-hopping-b';

  // The keys read whichever `onClose` is current, and focus returns to Close
  // only when the dialog opens or a card that covered it goes. Both used to
  // re-run with `onClose`, which the window hands over new on every render of
  // its own — several times a second while anything plays — so tabbing
  // through the ways to support kept snapping back to Close.
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
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
  });

  useEffect(() => {
    if (isCovered) {
      return undefined;
    }
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => handleKey(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isCovered]);

  const handleCopyAddress = async (id: SupportMethodId, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      setCopySeq((seq) => seq + 1);
    } catch {
      // Clipboard permission can be refused; the address stays selectable so
      // the donor is never stuck.
      setCopiedId('');
    }
  };

  const hasStripe = methods.includes('stripe');
  const hasCoffee = methods.includes('coffee');
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
      <DialogFrame
        ref={dialogRef}
        className="support-dialog"
        icon={<MenuIcon name="support" />}
        eyebrow={t('support.eyebrow')}
        title={t('support.title')}
        titleId="support-dialog-title"
        closeLabel={t('support.close')}
        onClose={onClose}
        closeRef={closeRef}
        rail={
          // The creature and the thing she is jumping, one piece: the trace
          // has to stay directly under her, and in a narrow window the two
          // stand side by side across the top.
          <div className="support-dialog__stage">
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
              {/* How long the face the tap earned stays: this mark's hold,
                  keyed on the tap so each one gets the whole of it, and its
                  end is what puts her resting face back. It was a timer,
                  which ran on behind a covered window. Draws nothing — the
                  face is the classes on the button. */}
              {mood && (
                <span
                  key={petTaps}
                  className="support-pet-tap__mood"
                  aria-hidden
                  onAnimationEnd={(event) => {
                    if (isOwnAnimationEnd(event, 'support-pet-mood')) {
                      setMood('');
                    }
                  }}
                />
              )}
            </button>

            {/* The game used to be hidden behind the contribution flag, so
                nobody could discover the play-to-unlock route before
                donating. */}
            <RhythmGame ref={gameRef} />
          </div>
        }
        footer={
          <>
            <p className="dialog-frame__note support-dialog__time">
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
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle support-dialog__action"
                onClick={onShowReleaseNotes}
              >
                <MenuIcon name="gift" />
                {t('app.menu.whatsNew')}
              </button>
              <SupportRainbowUnlock
                hasContributed={hasContributed}
                onContributed={onContributed}
              />
            </div>
          </>
        }
      >
        {/* The ask comes first, where the eye lands on the right side: the
            ways to give, each with what opens it. */}
        {(hasCoffee || hasStripe) && (
          <section className="dialog-frame__group support-dialog__give">
            {hasCoffee && (
              <div className="support-method support-method--qr">
                <div className="support-method__text">
                  <h3 className="support-method__label">
                    {t('support.coffee')}
                  </h3>
                  <p className="support-method__hint">
                    {t('support.coffee.hint')}
                  </p>
                  <a
                    className="button small support-dialog__action"
                    href={SUPPORT_CONFIG.coffeeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('support.coffee')}
                    <MenuIcon name="external" />
                  </a>
                </div>
                {/* The artwork ships with the app rather than being generated,
                    so the branded code from Buy Me a Coffee is what people
                    scan. It is therefore pinned to whatever page it was made
                    for — if FLUIDEQ_COFFEE_URL ever changes, replace this file
                    too. */}
                <img
                  className="qr-code"
                  src={supportQrImage}
                  alt={t('support.qr.coffee')}
                  width={168}
                  height={168}
                />
              </div>
            )}

            {hasStripe && (
              <div className="support-method">
                <div className="support-method__text">
                  <h3 className="support-method__label">{t('support.card')}</h3>
                  <p className="support-method__hint">
                    {t('support.card.hint')}
                  </p>
                  {/* The loud face belongs to the one way in with a code
                      beside it; with both on offer, this is the other. */}
                  <a
                    className={`button small${hasCoffee ? ' subtle' : ''} support-dialog__action`}
                    href={SUPPORT_CONFIG.stripeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('support.card')}
                    <MenuIcon name="external" />
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {cryptos.map(({ asset, address, uri }) => (
          <section
            className={`dialog-frame__group support-method${uri ? ' support-method--qr' : ''}`}
            key={asset.id}
          >
            <div className="support-method__text">
              <h3 className="support-method__label">
                {asset.name}
                <em>{asset.symbol}</em>
              </h3>
              {/* The network is called out because several of these share an
                  address format, and sending on the wrong one loses the funds
                  with no way to recover them. */}
              <p className="support-method__hint">
                {asset.network}. {t('support.verify')}
              </p>
            </div>
            {/* Scanning the URI beats retyping 40-odd characters, and the code
                is generated from the same string shown below it. */}
            {uri && (
              <QrCode
                value={uri}
                label={t('support.qr.address', { asset: asset.name })}
                size={168}
              />
            )}
            <code className="support-method__address">{address}</code>
            <div className="support-method__actions">
              <button
                type="button"
                className="button small subtle"
                onClick={() => handleCopyAddress(asset.id, address)}
              >
                {/* "Copied" for its moment: the word's own hold
                    (`support-copied`), whose end puts "Copy" back. */}
                {copiedId === asset.id ? (
                  <span
                    key={copySeq}
                    className="support-method__confirmed"
                    onAnimationEnd={(event) => {
                      if (isOwnAnimationEnd(event, 'support-copied')) {
                        setCopiedId('');
                      }
                    }}
                  >
                    {t('support.copied')}
                  </span>
                ) : (
                  t('support.copy')
                )}
              </button>
              {uri && (
                <a
                  className="button small subtle"
                  href={uri}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('support.openWallet')}
                </a>
              )}
            </div>
          </section>
        ))}

        <p className="support-dialog__pitch">{t('support.pitch')}</p>

        {/* Said plainly rather than implied, and in the maker's own voice.
            Someone deciding whether to contribute is entitled to know what
            they would be funding, and the answer here is one person's
            attention rather than a company's roadmap. */}
        <figure className="support-dialog__quote">
          <blockquote>{t('support.craft')}</blockquote>
          <figcaption>{AUTHOR_NAME}</figcaption>
        </figure>

        {/* Mac keyboards cannot produce Ctrl+Shift+Alt+B. Development gets a
            button for the same action, independent of the badge. Debug-only
            labels are deliberately untranslated. */}
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
      </DialogFrame>
    </div>
  );
}
