import Glyph from '../community/Glyph';

interface IStudioPictureViewButtonProps {
  /** Says which picture opens, since the picture itself is decoration. */
  label: string;
  onClick: () => void;
}

/**
 * The whole of a picture tile as one button that opens the picture large:
 * laid over the frame, so the tile keeps its layout, with a small enlarge
 * mark in the corner that the stylesheet only shows while it is pointed at
 * or focused.
 */
export default function StudioPictureViewButton({
  label,
  onClick,
}: IStudioPictureViewButtonProps) {
  return (
    <button
      type="button"
      className="studio-picture__view"
      aria-label={label}
      onClick={onClick}
    >
      <span className="studio-picture__zoom" aria-hidden="true">
        <Glyph name="expand" />
      </span>
    </button>
  );
}
