import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import StudioChatPictureViewer from '../studio/chat/StudioChatPictureViewer';
import { useTranslation } from '../utils/I18nContext';

/**
 * A post body, as React elements built from GitHub's rendering of it.
 *
 * GitHub sanitises what it renders, and this does not rely on that: the body
 * is a stranger's markup arriving over the network into the app's own window,
 * which can reach the main process. So it is never handed to `innerHTML`.
 * `DOMParser` reads it into an inert document — nothing in one runs, loads or
 * fetches — and each node is rebuilt here from an allowlist: known tags only,
 * no attribute that is not named below, links that leave for the browser,
 * images only from GitHub's own hosts (the ones the window's security policy
 * admits). Everything else is unwrapped to its text or dropped whole.
 *
 * Headings are moved down the scale: a post's `#` is a heading inside a
 * thread whose title is already the page's heading.
 */

const DROP = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'button',
  'textarea',
  'select',
  'svg',
  'math',
  'template',
  'noscript',
  'link',
  'meta',
  'audio',
  'canvas',
]);

const KEEP = new Set([
  'p',
  'br',
  'hr',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'ins',
  'mark',
  'sup',
  'sub',
  'kbd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'details',
  'summary',
  'dl',
  'dt',
  'dd',
]);

const TABLE_PARTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr']);

const HEADINGS: Record<string, string> = {
  h1: 'h3',
  h2: 'h4',
  h3: 'h5',
  h4: 'h6',
  h5: 'h6',
  h6: 'h6',
};

const ALERTS = new Set(['note', 'tip', 'important', 'warning', 'caution']);

/**
 * https only: a link here is handed to the system browser, and it is
 * somebody else's. Plain http let a post send a reader to a page anybody on
 * their network could rewrite on the way.
 */
const safeHref = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

/** Where a link goes, shown on hover: its words can say anything. */
const hostOf = (href: string) => new URL(href).host;

/** GitHub's hosts, exactly the ones `img-src` in the window's policy admits. */
export const isGithubImage = (value: string | null): boolean => {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'github.com' ||
        url.hostname.endsWith('.githubusercontent.com'))
    );
  } catch {
    return false;
  }
};

interface IForumImageProps {
  src: string;
  alt: string;
}

/**
 * Opens one of the post's pictures in the window-sized viewer (Ivan,
 * 2026-11-02: "when clicking one I want to open it right there in Fluid in a
 * modal that can be expanded"). Absent outside a post, where a picture is
 * only a picture.
 */
const PictureOpener = createContext<((src: string) => void) | undefined>(
  undefined,
);

/**
 * An image in a post, or a link to it when it will not load. GitHub signs
 * attachment URLs for a few minutes only, so an image read from the published
 * feed can have expired by the time it is drawn; a broken picture frame says
 * nothing, where a link still reaches it through GitHub.
 */
function ForumImage({ src, alt }: IForumImageProps) {
  const { t } = useTranslation();
  const open = useContext(PictureOpener);
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <a
        className="forum-prose__image-link"
        href={src}
        target="_blank"
        rel="noreferrer noopener"
      >
        {alt || t('forum.post.image')}
      </a>
    );
  }
  const picture = (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
  return open ? (
    <button
      type="button"
      className="forum-prose__picture"
      aria-label={alt || t('forum.post.image')}
      title={t('forum.post.image')}
      onClick={() => open(src)}
    >
      {picture}
    </button>
  ) : (
    picture
  );
}

const alertKind = (element: Element): string | undefined => {
  const match = /\bmarkdown-alert-([a-z]+)\b/.exec(element.className);
  return match && ALERTS.has(match[1]) ? match[1] : undefined;
};

const convert = (node: Node, key: number): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (DROP.has(tag)) {
    return null;
  }
  // The line breaks between a table's rows are text nodes in the parsed
  // document, and React refuses text directly inside table structure.
  const structural = TABLE_PARTS.has(tag);
  const children = () =>
    Array.from(element.childNodes)
      .filter(
        (child) =>
          !structural ||
          child.nodeType !== Node.TEXT_NODE ||
          (child.textContent ?? '').trim() !== '',
      )
      .map((child, index) => convert(child, index));

  if (tag === 'a') {
    const raw = element.getAttribute('href');
    const href = safeHref(raw);
    const inner = children();
    // In-page anchors (GitHub puts one beside every heading) lead nowhere
    // outside github.com; their text, if any, stays as text.
    if (!href) {
      return element.textContent?.trim()
        ? createElement(Fragment, { key }, ...inner)
        : null;
    }
    // GitHub wraps a pasted picture in a link to itself; the picture opens
    // in the viewer here, so the link around it would only lead away.
    if (element.querySelector('img')) {
      return createElement(Fragment, { key }, ...inner);
    }
    const mention = element.classList.contains('user-mention');
    return createElement(
      'a',
      {
        key,
        href,
        title: hostOf(href),
        target: '_blank',
        rel: 'noreferrer noopener',
        className: mention ? 'forum-prose__mention' : undefined,
      },
      ...inner,
    );
  }

  if (tag === 'img') {
    const src = element.getAttribute('src');
    const alt = element.getAttribute('alt') ?? '';
    if (!src || !isGithubImage(src)) {
      return alt ? createElement('span', { key }, alt) : null;
    }
    return createElement(ForumImage, { key, src, alt });
  }

  if (tag === 'video') {
    const src = safeHref(element.getAttribute('src'));
    return src
      ? createElement(
          'a',
          { key, href: src, target: '_blank', rel: 'noreferrer noopener' },
          src,
        )
      : null;
  }

  if (tag === 'input') {
    // Task lists: `- [x] done`. Shown, never changeable from here.
    return element.getAttribute('type') === 'checkbox'
      ? createElement('input', {
          key,
          type: 'checkbox',
          disabled: true,
          checked: element.hasAttribute('checked'),
          readOnly: true,
          className: 'forum-prose__task',
        })
      : null;
  }

  if (tag in HEADINGS) {
    return createElement(HEADINGS[tag], { key }, ...children());
  }

  if (tag === 'div') {
    const alert = alertKind(element);
    return alert
      ? createElement(
          'div',
          { key, className: `forum-prose__alert forum-prose__alert--${alert}` },
          ...children(),
        )
      : createElement(Fragment, { key }, ...children());
  }

  if (tag === 'span') {
    // GitHub's syntax colouring is a class per token; those, and nothing
    // else about a span, are kept for the code blocks' palette.
    const token = /^pl-[a-z0-9]+$/.test(element.className)
      ? element.className
      : undefined;
    return token
      ? createElement('span', { key, className: token }, ...children())
      : createElement(Fragment, { key }, ...children());
  }

  if (KEEP.has(tag)) {
    const props: Record<string, unknown> = { key };
    if (tag === 'ol') {
      const start = Number(element.getAttribute('start'));
      if (Number.isInteger(start) && start > 1) {
        props.start = start;
      }
    }
    if (tag === 'th' || tag === 'td') {
      const align = element.getAttribute('align');
      if (align === 'left' || align === 'center' || align === 'right') {
        props.style = { textAlign: align };
      }
    }
    if (tag === 'p' && element.classList.contains('markdown-alert-title')) {
      props.className = 'forum-prose__alert-title';
    }
    if (tag === 'ul' && element.classList.contains('contains-task-list')) {
      props.className = 'forum-prose__tasks';
    }
    return createElement(tag, props, ...children());
  }

  // Anything else — g-emoji, section, a custom element — is its contents.
  return createElement(Fragment, { key }, ...children());
};

export const renderGithubHtml = (html: string): ReactNode[] => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(parsed.body.childNodes).map((node, index) =>
    convert(node, index),
  );
};

interface IGithubHtmlProps {
  html: string;
  className?: string;
}

/** Every picture this body draws, in order, as the viewer steps through them. */
const picturesOf = (html: string) =>
  Array.from(
    new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img'),
  )
    .map((image) => ({
      src: image.getAttribute('src') ?? '',
      alt: image.getAttribute('alt') ?? '',
    }))
    .filter((image) => isGithubImage(image.src));

export default function GithubHtml({ html, className }: IGithubHtmlProps) {
  const { t } = useTranslation();
  const nodes = useMemo(() => renderGithubHtml(html), [html]);
  const pictures = useMemo(
    () =>
      picturesOf(html).map((image, index) => ({
        key: `${index}:${image.src}`,
        src: image.src,
        name: image.alt || t('forum.post.image'),
        cutOut: false,
      })),
    [html, t],
  );
  const [showing, setShowing] = useState<number>();
  const open = useMemo(
    () => (src: string) => {
      const at = pictures.findIndex((picture) => picture.src === src);
      setShowing(at < 0 ? undefined : at);
    },
    [pictures],
  );
  return (
    <PictureOpener.Provider value={open}>
      <div className={`forum-prose${className ? ` ${className}` : ''}`}>
        {nodes}
      </div>
      {showing !== undefined && (
        <StudioChatPictureViewer
          pictures={pictures}
          index={showing}
          onStep={setShowing}
          onClose={() => setShowing(undefined)}
        />
      )}
    </PictureOpener.Provider>
  );
}
