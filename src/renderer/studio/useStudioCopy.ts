import { useState, type RefObject } from 'react';

/** Puts every character of `element` in the selection, for Ctrl+C. */
export const selectAll = (element: HTMLElement | null) => {
  const selection = window.getSelection();
  if (element && selection) {
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }
};

/**
 * Copies `text`, and says so for exactly as long as it is still what would
 * be copied. A clipboard that refuses selects `fallback` instead, so Ctrl+C
 * does what the button could not.
 *
 * `copyText` copies what a press decided on after an answer it waited for
 * (the AI prompt asks main for the door first): shown as copied once `text`
 * has caught up with it, which it does when the same answer reaches the page.
 */
export const useStudioCopy = (
  text: string,
  fallback: RefObject<HTMLElement | null>,
) => {
  const [copied, setCopied] = useState<string>();
  const [refused, setRefused] = useState(false);
  const copyText = (value: string) => {
    const refuse = () => {
      setRefused(true);
      selectAll(fallback.current);
    };
    const write = navigator.clipboard?.writeText(value);
    if (!write) {
      refuse();
      return;
    }
    write
      .then(() => {
        setCopied(value);
        setRefused(false);
        return undefined;
      })
      .catch(refuse);
  };
  return {
    done: copied === text,
    refused,
    copy: () => copyText(text),
    copyText,
  };
};
