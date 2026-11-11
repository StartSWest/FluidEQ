import { useMemo } from 'react';
import { useTranslation } from '../utils/I18nContext';

const KILOBYTE = 1024;

/** A file's size the way the viewer's own language writes one. */
export const useFileSize = () => {
  const { locale } = useTranslation();
  return useMemo(() => {
    const format = (unit: 'kilobyte' | 'megabyte') =>
      new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      });
    const kilobytes = format('kilobyte');
    const megabytes = format('megabyte');
    return (bytes: number) =>
      bytes < KILOBYTE * KILOBYTE
        ? // Never "0 kB" for a file with something in it.
          kilobytes.format(Math.max(0.1, bytes / KILOBYTE))
        : megabytes.format(bytes / (KILOBYTE * KILOBYTE));
  }, [locale]);
};

/**
 * What stands after a file's name in the Code tab: how long it is and how
 * big, "312 lines · 9.8 kB". A file too large to show has no lines to count
 * and says its size alone.
 */
export const useFileMeta = (text: string | undefined, bytes: number) => {
  const { t } = useTranslation();
  const size = useFileSize();
  return useMemo(() => {
    if (text === undefined) {
      return size(bytes);
    }
    const count = text.split('\n').length;
    const lines =
      count === 1
        ? t('studio.code.oneLine')
        : t('studio.code.lines', { count });
    return `${lines} · ${size(bytes)}`;
  }, [text, bytes, size, t]);
};

const encoder = new TextEncoder();

/** The size a text will have on disk. */
export const bytesOf = (text: string) => encoder.encode(text).length;
