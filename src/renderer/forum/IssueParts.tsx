import type { IForumIssue } from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
import ForumGlyph from './ForumGlyph';

/**
 * What only an issue shows in the Forum: where it stands, its labels, and
 * where to answer it. An issue is read here and written on GitHub
 * (`forumIssues.ts` in main), so its thread ends with the way there instead
 * of a reply box.
 */

/** Open or closed, in GitHub's own two signs and colours. */
export function IssueState({ issue }: { issue: IForumIssue }) {
  const { t } = useTranslation();
  return (
    <span
      className={`forum__chip forum__chip--issue${issue.closed ? ' is-closed' : ''}`}
    >
      <ForumGlyph name={issue.closed ? 'issueClosed' : 'issue'} />
      {issue.closed ? t('forum.issue.closed') : t('forum.issue.open')}
    </span>
  );
}

/** The labels, quiet: the owner's words, under the state that matters more. */
export function IssueLabels({ issue }: { issue: IForumIssue }) {
  return (
    <>
      {issue.labels.map((label) => (
        <span key={label} className="forum__chip forum__chip--label">
          {label}
        </span>
      ))}
    </>
  );
}

/** Where a thread's reply box would be: the way to GitHub, where it is answered. */
export function IssueFoot({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <div className="forum__sign-in-prompt forum__issue-foot">
      <span>{t('forum.issue.commentHint')}</span>
      <a
        className="button small forum__github-link"
        href={url}
        target="_blank"
        rel="noreferrer noopener"
      >
        <ForumGlyph name="external" />
        {t('forum.issue.commentOnGithub')}
      </a>
    </div>
  );
}
