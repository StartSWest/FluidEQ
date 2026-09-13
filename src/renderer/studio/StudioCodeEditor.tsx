import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
} from 'react';
import { glslPieces } from './glslTokens';

interface IStudioCodeEditorProps {
  text: string;
  label: string;
  onText: (text: string) => void;
  onSave: () => void;
  /** Lines something is wrong on, in red. */
  wrong: ReadonlySet<number>;
  /** Lines the last outside save added or rewrote, in green. */
  added: ReadonlySet<number>;
  /** Lines with lines removed just above them. */
  removedAbove: ReadonlySet<number>;
  /** A line to bring into view, once per change. */
  reveal?: { id: number; line: number };
}

/**
 * The code itself: a textarea over its own highlighted copy. The textarea
 * holds the caret, the selection and the undo history the platform already
 * gives it; the copy under it paints the colours, the problem lines and the
 * lines an outside save just changed.
 */
export default function StudioCodeEditor({
  text,
  label,
  onText,
  onSave,
  wrong,
  added,
  removedAbove,
  reveal,
}: IStudioCodeEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const paintRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // One block per line, as many as the textarea has — a text ending in a
  // newline has an empty last line there too — so the two scroll alike.
  const lines = useMemo(
    () =>
      text.split('\n').map((line, number) => ({
        number: number + 1,
        pieces: glslPieces(line).map((piece, at) => ({ ...piece, at })),
      })),
    [text],
  );
  const lastLine = lines.length;

  const follow = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (paintRef.current) {
      paintRef.current.scrollTop = input.scrollTop;
      paintRef.current.scrollLeft = input.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = input.scrollTop;
    }
  }, []);

  // An outside save lands where the member can see it — unless they are
  // typing in the pane, where moving the view would move it out from under
  // their caret.
  const revealId = reveal?.id;
  const revealLine = reveal?.line;
  useEffect(() => {
    const input = inputRef.current;
    if (
      !input ||
      revealLine === undefined ||
      document.activeElement === input
    ) {
      return;
    }
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 16;
    input.scrollTop = Math.max(
      0,
      (revealLine - 1) * lineHeight - input.clientHeight / 3,
    );
    follow();
  }, [revealId, revealLine, follow]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      onSave();
      return;
    }
    // Tab indents, as in any code editor; Escape gives the key back to the
    // page so the keyboard can leave the pane.
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.setRangeText(
        '  ',
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd,
        'end',
      );
      onText(event.currentTarget.value);
      return;
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  };

  const lineClass = (number: number) =>
    [
      wrong.has(number) && 'is-wrong',
      added.has(number) && 'is-added',
      removedAbove.has(number) && 'is-cut-above',
      number === lastLine && removedAbove.has(lastLine + 1) && 'is-cut-below',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="studio-code__editor">
      <div ref={gutterRef} className="studio-code__gutter" aria-hidden="true">
        {lines.map((line) => (
          <span
            key={line.number}
            className={lineClass(line.number) || undefined}
          >
            {line.number}
          </span>
        ))}
      </div>
      <div className="studio-code__area">
        <pre ref={paintRef} className="studio-code__paint" aria-hidden="true">
          {lines.map((line) => (
            <span
              // A new outside change remakes the rows, so a line it touched
              // again lights up again rather than keeping last time's tint.
              key={`${revealId ?? 0}:${line.number}`}
              className={`studio-code__line ${lineClass(line.number)}`}
            >
              {line.pieces.map((piece) => (
                <span
                  key={piece.at}
                  className={`studio-code__glsl studio-code__glsl--${piece.kind}`}
                >
                  {piece.text}
                </span>
              ))}
              {/* An empty block has no height; a space gives it one. */}
              {line.pieces.length === 0 && ' '}
            </span>
          ))}
        </pre>
        <textarea
          ref={inputRef}
          className="studio-code__input"
          aria-label={label}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          value={text}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={onKeyDown}
          onScroll={follow}
        />
      </div>
    </div>
  );
}
