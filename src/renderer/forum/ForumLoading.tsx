import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import '../styles/ForumLoading.scss';

/**
 * What the Forum shows while a page is on its way: the page's own shape,
 * drawn to the bottom of the card, fading out over the content as it
 * arrives rather than being swapped for it.
 *
 * The layer sits over the page's scroller instead of inside it, so the
 * content can mount and rise in underneath while the placeholder is still
 * leaving — the two cross, and nothing jumps.
 */

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface IForumLoadingLayerProps {
  loading: boolean;
  children: ReactNode;
}

/**
 * Mounted while `loading`, and for the length of its fade after. Unmounted
 * on the fade's own end — the transition says when it is done — or at once
 * when motion is reduced, where no transition runs to say so.
 */
export function ForumLoadingLayer({
  loading,
  children,
}: IForumLoadingLayerProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(loading);
  const [leaving, setLeaving] = useState(false);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    setLeaving(true);
  }, [loading]);

  // The fade ending, or being cut short, is what takes the layer away. React
  // has no prop for the second, so both are listened to on the element.
  useEffect(() => {
    const element = layer.current;
    if (!element || !leaving) {
      return undefined;
    }
    const finish = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === 'opacity') {
        setMounted(false);
      }
    };
    element.addEventListener('transitionend', finish);
    element.addEventListener('transitioncancel', finish);
    return () => {
      element.removeEventListener('transitionend', finish);
      element.removeEventListener('transitioncancel', finish);
    };
  }, [leaving, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      ref={layer}
      className={`forum__loading${leaving ? ' is-leaving' : ''}`}
    >
      {!leaving && (
        <span className="forum__loading-status" role="status">
          {t('forum.loading')}
        </span>
      )}
      <div className="forum__loading-shape" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

/**
 * How many rows reach the bottom of the layer, and one more for the fade.
 * Measured from where the first row starts and the distance to the second,
 * so the count follows the rows' real height at every width and text size.
 * A resize is the only thing that asks again.
 */
const useRowsToFill = (
  scope: RefObject<HTMLElement | null>,
  selector: string,
  initial: number,
) => {
  const [rows, setRows] = useState(initial);

  useLayoutEffect(() => {
    const element = scope.current;
    const layer = element?.closest<HTMLElement>('.forum__loading');
    if (!element || !layer) {
      return undefined;
    }
    const measure = () => {
      const [first, second] = Array.from(
        element.querySelectorAll<HTMLElement>(selector),
      );
      if (!first || !second) {
        return;
      }
      const pitch =
        second.getBoundingClientRect().top - first.getBoundingClientRect().top;
      if (pitch <= 0) {
        return;
      }
      const room =
        layer.getBoundingClientRect().bottom -
        first.getBoundingClientRect().top;
      const needed = Math.max(2, Math.ceil(room / pitch) + 1);
      setRows((current) => (current === needed ? current : needed));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [scope, selector]);

  return rows;
};

// Widths that differ row to row, so the shape reads as text, not as a grid.
const TITLES = [58, 44, 67, 51, 62, 39, 55, 70, 47, 60];
const LINES = [91, 78, 86, 94, 72, 83, 88, 76, 95, 81];
const pick = (list: readonly number[], index: number) =>
  `${list[index % list.length]}%`;

/** The topic list's shape: a row per topic, to the bottom of the card. */
export function TopicListLoading() {
  const list = useRef<HTMLUListElement>(null);
  const rows = useRowsToFill(list, ':scope > li', 8);
  return (
    <ul className="forum__topics forum__loading-topics" ref={list}>
      {Array.from({ length: rows }, (_, row) => (
        <li key={row}>
          <span className="forum__topic forum__loading-topic">
            <span className="forum__bone forum__bone--avatar" />
            <span className="forum__topic-body">
              <span
                className="forum__bone forum__bone--title"
                style={{ width: pick(TITLES, row) }}
              />
              <span
                className="forum__bone forum__bone--line"
                style={{ width: pick(LINES, row) }}
              />
              <span
                className="forum__bone forum__bone--line"
                style={{ width: pick(LINES, row + 3) }}
              />
              <span className="forum__loading-meta">
                <span className="forum__bone forum__bone--chip" />
                <span className="forum__bone forum__bone--byline" />
              </span>
            </span>
            <span className="forum__topic-stats">
              <span className="forum__bone forum__bone--stat" />
              <span className="forum__bone forum__bone--stat" />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One post's shape: who wrote it, and the lines of what they wrote. */
function PostBones({
  lines,
  seed,
  opening = false,
}: {
  lines: number;
  seed: number;
  opening?: boolean;
}) {
  return (
    <div
      className={`forum-post forum__loading-post${opening ? ' forum-post--opening' : ''}`}
    >
      <span className="forum-post__head">
        <span className="forum__bone forum__bone--post-avatar" />
        <span className="forum__bone forum__bone--name" />
        <span className="forum__bone forum__bone--time" />
      </span>
      <span className="forum-post__body forum__loading-lines">
        {Array.from({ length: lines }, (_, line) => (
          <span
            key={line}
            className="forum__bone forum__bone--text"
            style={{
              width:
                line === lines - 1
                  ? pick(TITLES, seed)
                  : pick(LINES, seed + line),
            }}
          />
        ))}
      </span>
    </div>
  );
}

/** A thread's shape: its title, the opening post, and replies to the bottom. */
export function ThreadLoading() {
  const replies = useRef<HTMLOListElement>(null);
  const rows = useRowsToFill(replies, ':scope > li', 4);
  return (
    <div className="forum__thread forum__loading-thread">
      <div className="forum__thread-head">
        <span className="forum__bone forum__bone--chip" />
        <span className="forum__bone forum__bone--heading" />
        <span className="forum__bone forum__bone--heading forum__bone--heading-short" />
      </div>
      <PostBones lines={5} seed={2} opening />
      <div className="forum__replies-head forum__loading-replies-head">
        <span className="forum__bone forum__bone--label" />
      </div>
      <ol className="forum__comments" ref={replies}>
        {Array.from({ length: rows }, (_, row) => (
          <li key={row} className="forum__comment">
            <PostBones lines={2 + (row % 2)} seed={row + 4} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The boards the rail will list, while the forum says which there are. */
export function BoardsLoading() {
  return (
    <div className="forum__loading-boards" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <span key={row} className="community__channel forum__loading-board">
          <span className="forum__bone forum__bone--mark" />
          <span className="community__channel-text">
            <span
              className="forum__bone forum__bone--board-name"
              style={{ width: pick(TITLES, row + 1) }}
            />
            <span
              className="forum__bone forum__bone--board-blurb"
              style={{ width: pick(LINES, row) }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}
