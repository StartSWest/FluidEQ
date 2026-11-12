import { useTranslation } from '../utils/I18nContext';

export interface ICodeReason {
  /** The draft's line it is on, when that is known. */
  line?: number;
  text: string;
}

/**
 * Why a draft in the Code tab cannot be saved: each reason in words, after
 * the line it is on. The line is red in the file; pressing its number brings
 * it into view (`StudioCodeEditable.tsx`).
 */
export default function StudioCodeWhy({
  reasons,
  onLine,
}: {
  reasons: readonly ICodeReason[];
  onLine: (line: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="studio-code__why" role="alert">
      {reasons.map((reason, index) => (
        // eslint-disable-next-line react/no-array-index-key -- two reasons may be the same words
        <li key={index}>
          {reason.line !== undefined && (
            <button
              type="button"
              className="studio-code__why-line"
              onClick={() => onLine(reason.line ?? 1)}
            >
              {t('studio.code.atLine', { line: reason.line })}
            </button>
          )}
          <span>{reason.text}</span>
        </li>
      ))}
    </ul>
  );
}
