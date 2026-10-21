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
import Avatar from '../community/Avatar';
import { identityStyle } from '../community/identity';
import '../styles/ProfileNameForm.scss';

/** Exhaustive by type: a new failure does not compile until it has a sentence. */
const ERROR_KEYS: Record<TProfileFailure, TranslationKey> = {
  handle_taken: 'profile.name.error.handleTaken',
  name_reserved: 'profile.name.error.reserved',
  name_unreadable: 'profile.name.error.unreadable',
  signed_out: 'profile.name.error.signedOut',
  network: 'profile.name.error.network',
  rejected: 'profile.name.error.rejected',
};

interface IProfileNameFormProps {
  /**
   * The name as it is now, when one has been chosen: the form starts from it
   * and says it is a change, and nothing is sent until something differs.
   */
  initial?: { handle: string; displayName: string };
  /** Sends the name; resolves whether the server took it. */
  save: (handle: string, displayName: string) => Promise<boolean>;
  /** The name was saved. */
  onSaved: () => void;
  /** Offered only where the form can be put away without a name being saved. */
  onCancel?: () => void;
}

/**
 * Choosing the name the Visualizers gallery credits a member's published
 * scenes with, and changing it later, from the account panel.
 *
 * The card shows the member as the gallery will — their disc in their own
 * colour, the name, the @handle — and redraws it with every key, so the
 * choice is made looking at the result rather than at two empty boxes.
 */
export default function ProfileNameForm({
  initial,
  save,
  onSaved,
  onCancel,
}: IProfileNameFormProps) {
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
  const shownName = trimmedName || t('profile.name.previewName');

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
      className="profile-name"
      style={identityStyle(handle)}
      aria-labelledby={`${handleId}-title`}
      onSubmit={(event) => {
        submit(event).catch(() => undefined);
      }}
    >
      {/* How the gallery will show them, drawn from what is typed. */}
      <div className="profile-name__preview" aria-hidden="true">
        <Avatar handle={handle} displayName={shownName} size="podium" />
        <span className="profile-name__preview-name community__name community__name--hued">
          {shownName}
        </span>
        <span className="community__handle">@{handle || '…'}</span>
      </div>

      <div className="profile-name__body">
        <span id={`${handleId}-title`} className="profile-name__title">
          {t(initial ? 'account.name.changeTitle' : 'profile.name.title')}
        </span>
        <span className="profile-name__lead">
          {t(initial ? 'account.name.changeBody' : 'profile.name.body')}
        </span>

        <div className="profile-name__fields">
          <label className="profile-name__field" htmlFor={handleId}>
            <span className="profile-name__label">
              {t('profile.name.handle')}
              <span className="profile-name__hint">
                {t('profile.name.handleHint')}
              </span>
            </span>
            <span className="profile-name__at">
              <span aria-hidden="true">@</span>
              <input
                id={handleId}
                className="profile-name__handle"
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
          <label className="profile-name__field" htmlFor={nameId}>
            <span className="profile-name__label">
              {t('profile.name.name')}
            </span>
            <input
              id={nameId}
              className="profile-name__input"
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
            className="button small profile-name__save"
            disabled={!valid || saving}
          >
            {t('profile.name.save')}
          </button>
          {onCancel && (
            <button
              type="button"
              className="button small subtle profile-name__cancel"
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
          <p className="profile-name__error" role="alert">
            {t(ERROR_KEYS[error])}
          </p>
        )}
      </div>
    </form>
  );
}
