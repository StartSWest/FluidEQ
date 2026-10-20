import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { markAllForumRead } from './forumNew';
import { setForumNewsHidden } from './forumNewsPref';

interface IForumNewsMenuItemsProps {
  /** How many topics and issues have something new. */
  news: number;
  /** The count is switched off on Help's button. */
  hidden: boolean;
  /** How the menu these sit in runs a row: closes itself, then acts. */
  run: (action: () => void) => () => void;
}

/**
 * The two ways out of the Forum's count, under the Forum's row in whichever
 * menu holds it (Ivan, 2026-10-16): "mark all as read somewhere so the users
 * can clear the notification", "and also turn off that if they like". Where
 * the count is the thing that asks, these are where it is answered; the
 * Forum's own page has its "Mark all as read" too.
 *
 * Clearing is offered only while there is something to clear. The switch is
 * always there, so a count switched off can be switched back on from the
 * same place.
 */
export default function ForumNewsMenuItems({
  news,
  hidden,
  run,
}: IForumNewsMenuItemsProps) {
  const { t } = useTranslation();
  return (
    <>
      {!hidden && news > 0 && (
        <button
          type="button"
          role="menuitem"
          className="workspace-header__menu-item"
          onClick={run(markAllForumRead)}
        >
          <MenuIcon name="checkAll" />
          {t('forum.new.markAllRead')}
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className="workspace-header__menu-item"
        onClick={run(() => setForumNewsHidden(!hidden))}
      >
        <MenuIcon name={hidden ? 'bell' : 'bellOff'} />
        {hidden ? t('forum.news.show') : t('forum.news.hide')}
      </button>
    </>
  );
}
