import { useId, useState, type FormEvent } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import {
  HANDLE_PATTERN,
  MAX_DISPLAY_NAME,
  MAX_HANDLE,
  type TProfileFailure,
} from 'common/plusProfile';
import { useTranslation } from '../utils/I18nContext';
import { clearProfileError, useProfile } from '../plus/profileStore';
import Avatar from './Avatar';
import { identityStyle } from './identity';
import '../styles/LeaderboardName.scss';

/** Exhaustive by type: a new failure does not compile until it has a sentence. */
const ERROR_KEYS: Record<TProfileFailure, TranslationKey> = {
  handle_taken: 'leaderboard.name.error.handleTaken',
  name_reserved: 'leaderboard.name.error.reserved',
  name_unreadable: 'leaderboard.name.error.unreadable',
  signed_out: 'leaderboard.name.error.signedOut',
  network: 'leaderboard.name.error.network',
  rejected: 'leaderboard.name.error.rejected',
};

interface ILeaderboardNameProps {
  /**
   * The name as it is now, when one has been chosen: the form starts from it
   * and says it is a change, and nothing is sent until something differs.
   */
  initial?: { handle: string; displayName: string };
  /** Sends the name; resolves whether the server took it. */
  save: (handle: string, displayName: string) => Promise<boolean>;
  /** The name was saved; the board can be asked for again, now with them in it. */
  onSaved: () => void;
  /** Offered only where the form can be put away without a name being saved. */
  onCancel?: () => void;
}

/**
 * Choosing the name the board ranks — once, before a member can be on it —
 * and changing it later from the account panel.
 *
 * The server keeps each computer's listening under the member's profile, so
 * without one there is nothing to rank; and the handle and name are what the
 * Visualizers gallery credits a published scene with. The card shows the
 * member as the board will — their disc in their own colour, the name, the
 * @handle — and redraws it with every key, so the choice is made looking at
 * the result rather than at two empty boxes.
 */
export default function LeaderboardName({
  initial,
  save,
  onSaved,
  onCancel,
}: ILeaderboardNameProps) {
  const { t } = useTranslation();
  const { saving, error } = useProfile();
  const [handle, setHandle] = useState(initial?.handle ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const handleId = useId();
  const nameId = useId();

  const trimmedName = displayName.trim();
  const unchanged =
    initial !== undefined &&
    handle === initial.handle &&
    trimmedName === initial.displayName;
  const valid =
    HANDLE_PATTERN.test(handle) && trimmedName.length > 0 && !unchanged;
  const shownName = trimmedName || t('leaderboard.name.previewName');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || saving) {
      return;
    }
    if (await save(handle, trimmedName)) {
      onSaved();
    }
  };

  return (
    <form
      className="leaderboard-name"
      style={identityStyle(handle)}
      aria-labelledby={`${handleId}-title`}
      onSubmit={(event) => {
        submit(event).catch(() => undefined);
      }}
    >
      {/* How the board will show them, drawn from what is typed. */}
      <div className="leaderboard-name__preview" aria-hidden="true">
        <Avatar handle={handle} displayName={shownName} size="podium" />
        <span className="leaderboard-name__preview-name community__name community__name--hued">
          {shownName}
        </span>
        <span className="community__handle">@{handle || '…'}</span>
      </div>

      <div className="leaderboard-name__body">
        <span id={`${handleId}-title`} className="leaderboard-name__title">
          {t(initial ? 'account.name.changeTitle' : 'leaderboard.name.title')}
        </span>
        <span className="leaderboard-name__lead">
          {t(initial ? 'account.name.changeBody' : 'leaderboard.name.body')}
        </span>

        <div className="leaderboard-name__fields">
          <label className="leaderboard-name__field" htmlFor={handleId}>
            <span className="leaderboard-name__label">
              {t('leaderboard.name.handle')}
              <span className="leaderboard-name__hint">
                {t('leaderboard.name.handleHint')}
              </span>
            </span>
            <span className="leaderboard-name__at">
              <span aria-hidden="true">@</span>
              <input
                id={handleId}
                className="leaderboard-name__handle"
                type="text"
                value={handle}
                maxLength={MAX_HANDLE}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  clearProfileError();
                  setHandle(
                    event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  );
                }}
              />
            </span>
          </label>
          <label className="leaderboard-name__field" htmlFor={nameId}>
            <span className="leaderboard-name__label">
              {t('leaderboard.name.name')}
            </span>
            <input
              id={nameId}
              className="leaderboard-name__input"
              type="text"
              value={displayName}
              maxLength={MAX_DISPLAY_NAME}
              autoComplete="off"
              onChange={(event) => {
                clearProfileError();
                setDisplayName(event.target.value);
              }}
            />
          </label>
          <button
            type="submit"
            className="button small leaderboard-name__save"
            disabled={!valid || saving}
          >
            {t('leaderboard.name.save')}
          </button>
          {onCancel && (
            <button
              type="button"
              className="button small subtle leaderboard-name__cancel"
              onClick={() => {
                clearProfileError();
                onCancel();
              }}
            >
              {t('account.name.cancel')}
            </button>
          )}
        </div>

        {error && (
          <p className="leaderboard__error" role="alert">
            {t(ERROR_KEYS[error])}
          </p>
        )}
      </div>
    </form>
  );
}
