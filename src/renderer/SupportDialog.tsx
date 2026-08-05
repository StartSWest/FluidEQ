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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  SUPPORT_CONFIG,
  SupportMethodId,
  getSupportCryptos,
  getSupportMethods,
} from 'common/support';
import { winEuphoria } from './utils/euphoriaMode';
import supportQrImage from '../../assets/support-qr.png';
import QrCode from './components/QrCode';
import RhythmGame, { IRhythmGameHandle } from './components/RhythmGame';
import { SupportPetHero } from './SupportPet';
import { useTranslation } from './utils/I18nContext';
import './styles/Support.scss';

/**
 * Development builds only, and webpack removes the branch entirely from a
 * release: `process.env.NODE_ENV` is substituted with a literal at build time,
 * so `'production' !== 'production'` folds to `false` and the button below is
 * dead code the minifier drops. It cannot reach a user by accident.
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

interface ISupportDialogProps {
  hasContributed: boolean;
  onContributed: () => void;
  /**
   * Put the badge back to unearned. Everything the creature does — the game,
   * the tap, euphoria mode — is behind that one flag, and it is a one-way door
   * by design, so there is otherwise no way to see the unearned state again
   * without clearing local storage by hand.
   */
  onResetContribution: () => void;
  onClose: () => void;
  /** Open the release notes on top of this dialog. */
  onShowReleaseNotes: () => void;
  /**
   * True while another dialog is stacked over this one.
   *
   * Both dialogs listen for Escape on the document and both trap Tab, so the
   * covered one has to stand down or a single keypress closes them both and
   * focus is fought over between two modals.
   */
  isCovered?: boolean;
}

const COPY_FEEDBACK_MS = 2000;

/** How long the creature keeps the face the last tap earned it. */
const PET_MOOD_MS = 700;

/**
 * How long the badge celebration runs before the panel becomes the new one.
 *
 * Long enough to register as a moment and short enough not to be a wait. The
 * badge is earned exactly once per install and everything the creature can do
 * is behind it, so arriving with no ceremony — the panel simply having
 * different contents on the next frame — read as a glitch rather than as
 * something being unlocked.
 */
const BADGE_CELEBRATION_MS = 1500;

/**
 * Stars in the burst.
 *
 * Laid out on a fixed ring rather than at random: two people earning the badge
 * should see the same thing, and a random spread reliably produces one run
 * with three stars stacked on top of each other.
 */
const BADGE_STARS = 12;

export default function SupportDialog({
  hasContributed,
  onContributed,
  onResetContribution,
  onClose,
  onShowReleaseNotes,
  isCovered = false,
}: ISupportDialogProps) {
  const { t } = useTranslation();
  const methods = getSupportMethods();
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
  // One tap does both. Scoring goes through a ref rather than an effect on the
  // counter, so the moment that is graded is the moment the key went down —
  // an effect would score a render later, which in a game about timing is a
  // handicap the player did not earn.
  // The tap's result comes back out of the game, because the creature that
  // reacts to it lives up here rather than in the panel.
  //
  // The mood is a reaction to one tap and is dropped after a moment — left up
  // it stops being a reaction and becomes the pet's face. The streak itself is
  // not held here at all: it lives in the run store and is put on the document
  // root by the shell, so it outlives this dialog being closed.
  const [mood, setMood] = useState<'perfect' | 'miss' | ''>('');
  const moodResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // The one-off arrival. Held here rather than derived from the badge, because
  // it has to run BEFORE the badge exists — the celebration is the thing that
  // hands it over.
  const [isEarning, setIsEarning] = useState(false);
  const earnRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Earn the badge, with a moment made of it.
   *
   * The flag is flipped at the END of the animation rather than the start, so
   * the stars play over the panel that asked for the contribution and the new
   * one arrives as the thing they were leading up to. Flipping first put the
   * game on screen underneath the celebration, which read as the panel having
   * already changed and the stars being decoration over it.
   */
  const earnBadge = useCallback(() => {
    setIsEarning(true);
    earnRef.current = setTimeout(() => {
      earnRef.current = undefined;
      setIsEarning(false);
      onContributed();
    }, BADGE_CELEBRATION_MS);
  }, [onContributed]);
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
      // Closing the panel mid-celebration must not lose the badge. The timer
      // is what hands it over, so if it is still pending when this unmounts
      // the contribution is credited immediately rather than dropped.
      if (earnRef.current !== undefined) {
        clearTimeout(earnRef.current);
        onContributed();
      }
    },
    // Intentionally empty: this is unmount cleanup, and re-running it whenever
    // the parent hands down a new callback identity would credit the badge on
    // every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Space bounces the pet, for supporters only.
      //
      // It has to be swallowed. The close button takes focus when the dialog
      // opens, so an un-prevented space would activate it and the dialog would
      // shut on the first press — and every later press would land on whatever
      // else had focus. Enter still activates buttons, which is the standard
      // fallback, and someone without the badge never reaches this branch, so
      // nobody pays for a toy they do not have.
      if (event.key === ' ' && hasContributed) {
        event.preventDefault();
        bouncePet();
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
  }, [bouncePet, hasContributed, isCovered, onClose]);

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
        // The game changes the header's job. Without it the creature is a mark
        // beside a title; with it she is the thing being aimed, and she has to
        // sit over the line she is jumping.
        className={`support-dialog${hasContributed ? ' support-dialog--game' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-dialog-title"
      >
        <div className="support-dialog__header">
          <div className="support-dialog__identity">
            {/* A button only for supporters: without the badge there is
                nothing to press, and a control that does nothing is worse
                than no control. Clicking does what space does, since space
                is standing in for the click. */}
            {hasContributed ? (
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
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    bouncePet();
                  }
                }}
              >
                <SupportPetHero hasContributed={hasContributed} />
              </button>
            ) : (
              <SupportPetHero hasContributed={hasContributed} />
            )}
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

        {/* Below the header rather than inside it: the header is a row with the
            close button, and the heartbeat needs the full width for the spike
            to have somewhere to travel. Supporters only, like everything else
            the creature does. */}
        {hasContributed && <RhythmGame ref={gameRef} />}

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
          <p className="support-dialog__thanks">
            {t('support.thanks')}
            {/* Untranslated on purpose. Every other string here is in ten
                locales and a test enforces that; a debug affordance that
                never ships would mean ten translations of something no user
                will read. */}
            {IS_DEV && (
              <>
                {/* Thirty-six consecutive perfect taps is the right price for
                    euphoria mode and the wrong price for LOOKING at it. Every
                    change to the rainbow — the bands, the graph trace, the
                    titlebar meter, the share card — otherwise costs a flawless
                    run against real music before it can be seen at all.

                    It flips the two flags and touches nothing else. It used to
                    write a streak of 36 and a matching score straight into the
                    run, which meant the shortcut invented points nobody played
                    for — and left the share card showing a number that had
                    never been earned. The score belongs to the player. */}
                <button
                  type="button"
                  className="support-dialog__dev-reset"
                  title="Development build only — switches euphoria mode on without playing for it"
                  onClick={winEuphoria}
                >
                  dev: euphoria
                </button>
                <button
                  type="button"
                  className="support-dialog__dev-reset"
                  title="Development build only — clears the contributed flag"
                  onClick={onResetContribution}
                >
                  dev: remove badge
                </button>
              </>
            )}
          </p>
        ) : (
          <button
            type="button"
            className="support-dialog__contributed"
            disabled={isEarning}
            onClick={earnBadge}
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

      {/* The moment itself, and a sibling of the panel rather than a child of
          it. The panel scrolls and clips its own overflow, so a burst inside
          would be cut off at its edges and would drift if the list had been
          scrolled. Out here it covers the whole modal, centred on it, and it
          is removed the instant it is over — a permanent invisible overlay
          across a dialog full of buttons is a hit-testing problem waiting to
          happen. */}
      {isEarning && (
        <div className="support-earn" aria-hidden="true">
          <span className="support-earn__core">★</span>
          {Array.from({ length: BADGE_STARS }, (_value, index) => (
            <span
              key={index}
              className="support-earn__star"
              // The ring is computed here rather than written out as a dozen
              // nth-child rules: one angle per star, evenly spaced, and the
              // count changes by editing one number.
              style={
                {
                  '--star-angle': `${(index * 360) / BADGE_STARS}deg`,
                  '--star-delay': `${index * 18}ms`,
                } as CSSProperties
              }
            >
              ★
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
