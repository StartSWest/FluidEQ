/**
 * A cube, drawn in the label's own ink: the mark of a scene that has depth
 * to move through. One shape for the card and the stage, sized by them.
 */
export default function SceneMoveMark() {
  return (
    <svg
      className="scene-move-mark"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.8 13.6 5v6L8 14.2 2.4 11V5z" />
      <path d="M2.4 5 8 8.2 13.6 5M8 8.2v6" />
    </svg>
  );
}
