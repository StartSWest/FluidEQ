import { useId, useState, type FormEvent } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import {
  HANDLE_PATTERN,
  MAX_DISPLAY_NAME,
  MAX_HANDLE,
  type TProfileFailure,
} from 'common/plusProfile';
import { useTranslation } from '../utils/I18nContext';
import {
  clearProfileError,
  createProfile,
  useProfile,
} from '../plus/profileStore';
import Avatar from './Avatar';
import { identityStyle } from './identity';
import '../styles/LeaderboardName.scss';

/** Exhaustive by type: a new failure does not compile until it has a sentence. */
const ERROR_KEYS: Record<TProfileFailure, TranslationKey> = {
  handle_taken: 'leaderboard.name.error.handleTaken',
  signed_out: 'leaderboard.name.error.signedOut',
  network: 'leaderboard.name.error.network',
  rejected: 'leaderboard.name.error.rejected',
};

interface ILeaderboardNameProps {
  /** The name was saved; the board can be asked for again, now with them in it. */
  onSaved: () => void;
}

/**
 * Choosing the name the board ranks — once, before a member can be on it.
 *
 * The server keeps each computer's listening under the member's profile, so
 * without one there is nothing to rank; and the handle and name are what the
 * Visualizers gallery credits a published scene with. The card shows the
 * member as the board will — their disc in their own colour, the name, the
 * @handle — and redraws it with every key, so the choice is made looking at
 * the result rather than at two empty boxes.
 */
export default function LeaderboardName({ onSaved }: ILeaderboardNameProps) {
  const { t } = useTranslation();
  const { saving, error } = useProfile();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const handleId = useId();
  const nameId = useId();

  const valid = HANDLE_PATTERN.test(handle) && displayName.trim().length > 0;
  const shownName = displayName.trim() || t('leaderboard.name.previewName');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || saving) {
      return;
    }
    if (await createProfile(handle, displayName.trim())) {
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
          {t('leaderboard.name.title')}
        </span>
        <span className="leaderboard-name__lead">
          {t('leaderboard.name.body')}
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
