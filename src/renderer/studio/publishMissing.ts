/**
 * What still holds a publication back, part by part, in the order the parts
 * stand in the dialog, and the way to each one.
 *
 * Ivan, 2026-11-14: "the button is disabled with no reason on the publish
 * screen". The reason was there, in small grey type between the terms and
 * Cancel, and read as nothing. Now the footer names every part still
 * missing and where it is, each a way there, and the press itself — never
 * disabled for a missing part — goes to the first one.
 */
export type TPublishPart = 'name' | 'video' | 'category' | 'size' | 'note';

export interface IPublishGaps {
  /** The account has no public name and @handle yet. */
  name: boolean;
  /** No playable preview of the scene as it is now. */
  video: boolean;
  category: boolean;
  /** Over the most a scene can be published at. */
  size: boolean;
  /** No line about the scene, or about what changed. */
  note: boolean;
}

/** The dialog's own order, top to bottom. */
const ORDER: readonly TPublishPart[] = [
  'name',
  'video',
  'category',
  'size',
  'note',
];

export const missingParts = (gaps: IPublishGaps): TPublishPart[] =>
  ORDER.filter((part) => gaps[part]);

/** The attribute a part's section carries, for the way to it. */
const PART_ATTRIBUTE = 'data-publish-part';

const FOCUSABLE =
  'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]';

/**
 * Brings a part into view, puts the focus in it — `focus` when the part
 * names the control, else its first one — and outlines it once. The outline
 * is a CSS animation; the class goes when it ends, or when the focus leaves
 * the part first, so a window with animations off is not left outlined.
 */
export const callPart = (
  surface: HTMLElement | null,
  part: TPublishPart,
  focus?: HTMLElement | null,
): boolean => {
  const target = surface?.querySelector<HTMLElement>(
    `[${PART_ATTRIBUTE}="${part}"]`,
  );
  if (!target) {
    return false;
  }
  const reduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  // jsdom has no scrolling; a browser always does.
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({
      block: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }
  (focus ?? target.querySelector<HTMLElement>(FOCUSABLE) ?? target).focus({
    preventScroll: true,
  });
  const controller = new AbortController();
  const end = () => {
    target.classList.remove('is-called');
    controller.abort();
  };
  target.classList.remove('is-called');
  // Read a layout value so a second press restarts the outline rather than
  // finding the class already there.
  target.getBoundingClientRect();
  target.classList.add('is-called');
  // The part's own outline only: a chip's or a button's animation inside it
  // bubbles here too.
  target.addEventListener(
    'animationend',
    (event) => {
      if (event.target === target) {
        end();
      }
    },
    { signal: controller.signal },
  );
  target.addEventListener('focusout', end, { signal: controller.signal });
  return true;
};
