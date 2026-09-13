import { useMemo } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { glslPieces } from './glslTokens';
import { diffRows, type IDiffLine } from './lineDiff';

const SIGNS = { same: ' ', add: '+', remove: '−' } as const;

/**
 * The last outside change as a diff: removed lines in red, added ones in
 * green, three unchanged lines around each change and every longer
 * unchanged run folded to a count. Read-only; the code is edited in the
 * pane's own view.
 */
export default function StudioCodeDiff({
  lines,
}: {
  lines: readonly IDiffLine[];
}) {
  const { t } = useTranslation();
  const rows = useMemo(
    () =>
      diffRows(lines).map((row, at) =>
        row.kind === 'skip'
          ? { ...row, at }
          : {
              ...row,
              at,
              pieces: glslPieces(row.text).map((piece, index) => ({
                ...piece,
                index,
              })),
            },
      ),
    [lines],
  );
  return (
    <div
      className="studio-code__diff"
      role="region"
      aria-label={t('studio.code.showChanges')}
    >
      {rows.map((row) =>
        row.kind === 'skip' ? (
          <div key={row.at} className="studio-code__skip">
            {t('studio.code.unchanged', { count: row.count })}
          </div>
        ) : (
          <div
            key={row.at}
            className={`studio-code__row studio-code__row--${row.kind}`}
          >
            <span className="studio-code__num">{row.oldLine ?? ''}</span>
            <span className="studio-code__num">{row.newLine ?? ''}</span>
            <span className="studio-code__sign" aria-hidden="true">
              {SIGNS[row.kind]}
            </span>
            <code>
              {row.pieces.map((piece) => (
                <span
                  key={piece.index}
                  className={`studio-code__glsl studio-code__glsl--${piece.kind}`}
                >
                  {piece.text}
                </span>
              ))}
            </code>
          </div>
        ),
      )}
    </div>
  );
}
