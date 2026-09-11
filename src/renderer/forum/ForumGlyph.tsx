import Glyph from '../community/Glyph';

export type TForumGlyph =
  | 'threads'
  | 'megaphone'
  | 'general'
  | 'ideas'
  | 'poll'
  | 'question'
  | 'showcase'
  | 'upvote'
  | 'reply'
  | 'edit'
  | 'answer'
  | 'search'
  | 'back'
  | 'external'
  | 'lock'
  | 'delete'
  | 'refresh'
  | 'plus'
  | 'close'
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'quote'
  | 'list';

interface IForumGlyphProps {
  name: TForumGlyph;
  className?: string;
}

/**
 * The forum's small pictures, in the Plus tab's drawing language: a
 * 20-unit grid, stroked in `currentColor`, so each takes its row's state.
 * The ones that set already draws — its bubbles, its bulb, its lock, bin
 * and arrows — are borrowed from it, not redrawn here.
 */
export default function ForumGlyph({ name, className }: IForumGlyphProps) {
  switch (name) {
    case 'general':
      return <Glyph name="general" className={className} />;
    case 'ideas':
      return <Glyph name="feature-requests" className={className} />;
    case 'lock':
    case 'delete':
    case 'refresh':
      return <Glyph name={name} className={className} />;
    default:
      break;
  }
  const path = (() => {
    switch (name) {
      case 'threads':
        // Three topics stacked, the top one with its bubble's tail.
        return (
          <>
            <path d="M3.5 3.5h13a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H9l-2.5 2V8.5h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
            <path d="M5 13h12M5 16.5h8" opacity="0.65" />
          </>
        );
      case 'megaphone':
        return (
          <>
            <path d="M3 8.2v3.6a1 1 0 0 0 1 1h2L13.5 16V4L6 7.2H4a1 1 0 0 0-1 1Z" />
            <path d="M6.5 12.8 7.6 17h2.1l-.9-3.4M16 7.5a3.5 3.5 0 0 1 0 5" />
          </>
        );
      case 'poll':
        // Three bars of a result, the leader marked.
        return (
          <>
            <path d="M3.5 5h9M3.5 10h13M3.5 15h6" />
            <circle cx="16.5" cy="5" r="1.2" opacity="0.65" />
          </>
        );
      case 'question':
        return (
          <>
            <circle cx="10" cy="10" r="7.5" />
            <path d="M7.7 7.6a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 2-2.3 3.4" />
            <path d="M10 14.4v.1" />
          </>
        );
      case 'showcase':
        // A frame with a spark: something made, held up.
        return (
          <>
            <rect x="2.5" y="5" width="11" height="10" rx="1.6" />
            <path d="m4.8 12.6 2.6-2.8 2 2 1.3-1.3 1.8 2.1" opacity="0.7" />
            <path d="M16.5 2.5v4M14.5 4.5h4M16.8 10.5v2.6M15.5 11.8h2.6" />
          </>
        );
      case 'upvote':
        return <path d="M10 4.5 15.5 12H12v4H8v-4H4.5L10 4.5Z" />;
      case 'reply':
        return <path d="M8 5 3.5 9.5 8 14M3.5 9.5h8a5 5 0 0 1 5 5V16" />;
      case 'edit':
        return (
          <>
            <path d="M4 16l.6-3.3 8.6-8.6a1.6 1.6 0 0 1 2.3 0l.4.4a1.6 1.6 0 0 1 0 2.3l-8.6 8.6Z" />
            <path d="m11.8 5.5 2.7 2.7" />
          </>
        );
      case 'answer':
        return (
          <>
            <circle cx="10" cy="10" r="7.5" />
            <path d="m6.8 10.2 2.2 2.2 4.3-4.6" />
          </>
        );
      case 'search':
        return (
          <>
            <circle cx="8.8" cy="8.8" r="5.3" />
            <path d="m12.8 12.8 3.7 3.7" />
          </>
        );
      case 'back':
        return <path d="M12 4.5 6.5 10l5.5 5.5" />;
      case 'external':
        return (
          <>
            <path d="M11.5 3.5h5v5M16.5 3.5 9.5 10.5" />
            <path d="M14.5 11.5v4a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h4" />
          </>
        );
      case 'plus':
        return <path d="M10 4v12M4 10h12" />;
      case 'close':
        return <path d="m5 5 10 10M15 5 5 15" />;
      case 'bold':
        return <path d="M6 4h5a3 3 0 0 1 0 6H6V4Zm0 6h6a3 3 0 0 1 0 6H6v-6Z" />;
      case 'italic':
        return <path d="M9 4h6M5 16h6M12 4 8 16" />;
      case 'code':
        return <path d="M7 6 3 10l4 4M13 6l4 4-4 4" />;
      case 'link':
        return (
          <>
            <path d="M8.6 11.4a3 3 0 0 0 4.3 0l2.5-2.5a3 3 0 0 0-4.3-4.3l-.9.9" />
            <path d="M11.4 8.6a3 3 0 0 0-4.3 0l-2.5 2.5a3 3 0 0 0 4.3 4.3l.9-.9" />
          </>
        );
      case 'quote':
        return (
          <>
            <path d="M4 4.5v11" />
            <path d="M8 7h8M8 10.5h8M8 14h5" opacity="0.7" />
          </>
        );
      case 'list':
        return (
          <>
            <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5" />
            <path d="M4 5.5h.1M4 10h.1M4 14.5h.1" />
          </>
        );
      default:
        return null;
    }
  })();
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

/** GitHub's own mark (Octicons `mark-github`, MIT), for the sign-in button. */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/** Which picture a board gets, by the slug GitHub gives its categories. */
export const boardGlyph = (slug: string): TForumGlyph => {
  switch (slug) {
    case 'announcements':
      return 'megaphone';
    case 'general':
      return 'general';
    case 'ideas':
      return 'ideas';
    case 'polls':
      return 'poll';
    case 'q-a':
      return 'question';
    case 'show-and-tell':
      return 'showcase';
    default:
      return 'threads';
  }
};
