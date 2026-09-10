import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type {
  ICommunityChannel,
  ICommunityProfile,
  TCommunityFailure,
} from 'main/community/communityApi';
import type { TranslationKey } from 'common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { channelName } from './channelNames';
import Glyph from './Glyph';

interface IComposerProps {
  channel: ICommunityChannel;
  profile?: ICommunityProfile;
  profileLoaded: boolean;
  entitled: boolean;
  checkoutAvailable: boolean;
  error?: TCommunityFailure;
  onSend: (body: string) => Promise<boolean>;
  onCreateProfile: (handle: string, displayName: string) => Promise<boolean>;
  onAcceptConduct: () => Promise<boolean>;
  onUpgrade: () => void;
  onClearError: () => void;
}

/**
 * Exhaustive by type: a new failure does not compile until it has a sentence.
 * The word came from the server's trigger, and this is where it becomes
 * something a person can act on.
 */
const ERROR_KEYS: Record<TCommunityFailure, TranslationKey> = {
  banned: 'community.error.banned',
  handle_required: 'community.error.handleRequired',
  handle_taken: 'community.error.handleTaken',
  conduct_required: 'community.error.conductRequired',
  plus_required: 'community.error.plusRequired',
  contributor_required: 'community.error.contributorRequired',
  admin_required: 'community.error.adminRequired',
  rate_limited: 'community.error.rateLimited',
  empty: 'community.error.empty',
  immutable: 'community.error.immutable',
  network: 'community.error.network',
  signed_out: 'community.error.signedOut',
  rejected: 'community.error.rejected',
};

const HANDLE = /^[a-z0-9_]{3,20}$/;
const MAX_LENGTH = 1000;
/** The counter appears only once it matters; a number on every keystroke is noise. */
const COUNTER_FROM = 800;

/**
 * The bottom of the panel: whatever stands between this person and posting.
 *
 * One component, several states, in the order a new member meets them: no
 * subscription, no handle, no agreement to the code of conduct, a channel they
 * may not write in, and finally the box itself. Each state says exactly what
 * is missing and offers the one action that supplies it. The loud button is
 * the one being recommended in that state and nothing else.
 *
 * The box is one rounded bar with the send arrow inside it, the way every
 * chat this person already uses draws it; Enter sends and Shift+Enter breaks
 * the line, and the bar says so underneath.
 */
export default function Composer({
  channel,
  profile,
  profileLoaded,
  entitled,
  checkoutAvailable,
  error,
  onSend,
  onCreateProfile,
  onAcceptConduct,
  onUpgrade,
  onClearError,
}: IComposerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const errorLine = error && (
    <p className="community__error" role="alert">
      {t(ERROR_KEYS[error])}
    </p>
  );

  if (!entitled) {
    return (
      <div className="community__gate">
        <span className="community__gate-mark" aria-hidden="true">
          <Glyph name="lock" />
        </span>
        <div className="community__gate-text">
          <span className="community__gate-title">
            {t('community.plusOnly.title')}
          </span>
          <span className="community__gate-body">
            {t('community.plusOnly.body')}
          </span>
        </div>
        {checkoutAvailable && (
          <button type="button" className="button small" onClick={onUpgrade}>
            {t('community.upgrade')}
          </button>
        )}
      </div>
    );
  }

  if (!profileLoaded) {
    return (
      <div className="community__gate community__gate--quiet">
        {t('community.loading')}
      </div>
    );
  }

  if (!profile) {
    const valid = HANDLE.test(handle) && displayName.trim().length > 0;
    const submit = async (event: FormEvent) => {
      event.preventDefault();
      if (!valid || busy) {
        return;
      }
      setBusy(true);
      await onCreateProfile(handle, displayName.trim());
      setBusy(false);
    };
    return (
      <form className="community__gate community__gate--form" onSubmit={submit}>
        <span className="community__gate-mark" aria-hidden="true">
          <Glyph name="mention" />
        </span>
        <div className="community__gate-text">
          <span className="community__gate-title">
            {t('community.handle.title')}
          </span>
          <span className="community__gate-body">
            {t('community.handle.body')}
          </span>
          <div className="community__fields">
            <label className="community__field" htmlFor="community-handle">
              <span>{t('community.handle.handle')}</span>
              <span className="community__at-field">
                <span aria-hidden="true">@</span>
                <input
                  id="community-handle"
                  type="text"
                  value={handle}
                  maxLength={20}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    onClearError();
                    setHandle(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, ''),
                    );
                  }}
                />
              </span>
            </label>
            <label
              className="community__field"
              htmlFor="community-display-name"
            >
              <span>{t('community.handle.name')}</span>
              <input
                id="community-display-name"
                type="text"
                value={displayName}
                maxLength={40}
                autoComplete="off"
                onChange={(event) => {
                  onClearError();
                  setDisplayName(event.target.value);
                }}
              />
            </label>
          </div>
          {errorLine}
        </div>
        <button
          type="submit"
          className="button small"
          disabled={!valid || busy}
        >
          {t('community.handle.save')}
        </button>
      </form>
    );
  }

  if (!profile.acceptedConductAt) {
    return (
      <div className="community__gate">
        <span className="community__gate-mark" aria-hidden="true">
          <Glyph name="help" />
        </span>
        <div className="community__gate-text">
          <span className="community__gate-title">
            {t('community.conduct.title')}
          </span>
          <span className="community__gate-body">
            {t('community.conduct.rules')}
          </span>
          {errorLine}
        </div>
        <button
          type="button"
          className="button small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onAcceptConduct();
            setBusy(false);
          }}
        >
          {t('community.conduct.accept')}
        </button>
      </div>
    );
  }

  const mayWrite =
    channel.writeRole === 'plus' ||
    (channel.writeRole === 'contributor' &&
      (profile.role === 'contributor' || profile.role === 'admin')) ||
    (channel.writeRole === 'admin' && profile.role === 'admin');

  if (!mayWrite) {
    return (
      <div className="community__gate community__gate--quiet">
        <Glyph name="lock" />
        {t('community.contributorsOnly')}
      </div>
    );
  }

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) {
      return;
    }
    setBusy(true);
    const sent = await onSend(body);
    setBusy(false);
    if (sent) {
      setDraft('');
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line — the convention every chat this
    // person has used already taught them.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send().catch(() => undefined);
    }
  };

  const canSend = !busy && draft.trim().length > 0;

  return (
    <div className="community__composer">
      {errorLine}
      <div className="community__composer-box">
        <textarea
          className="community__input"
          value={draft}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder={t('community.composer.placeholder', {
            channel: channelName(channel, t),
          })}
          onChange={(event) => {
            onClearError();
            setDraft(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className={`community__send${canSend ? ' is-ready' : ''}`}
          disabled={!canSend}
          aria-label={t('community.send')}
          title={t('community.send')}
          onClick={() => {
            send().catch(() => undefined);
          }}
        >
          <Glyph name="send" />
        </button>
      </div>
      <div className="community__composer-foot">
        <span className="community__composer-hint">
          {t('community.composer.hint')}
        </span>
        {draft.length >= COUNTER_FROM && (
          <span
            className={`community__composer-count${draft.length >= MAX_LENGTH ? ' is-full' : ''}`}
          >
            {draft.length} / {MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
