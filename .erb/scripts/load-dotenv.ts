import fs from 'fs';
import path from 'path';
import webpackPaths from '../configs/webpack.paths';

/**
 * Minimal .env reader.
 *
 * The build needs a handful of public, build-time strings (see .env.example)
 * and nothing more, so this avoids taking on a dependency for ~20 lines of
 * parsing. It deliberately does NOT support interpolation, multi-line values
 * or `export` prefixes: anything that needs those does not belong in a file
 * whose contents get inlined into a client bundle.
 *
 * Variables already present in the environment win, so CI and shell overrides
 * beat a stale local file.
 */
const parse = (contents: string): Record<string, string> => {
  const values: Record<string, string> = {};

  contents.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      return;
    }

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return;
    }

    let value = line.slice(separator + 1).trim();
    const isQuoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (isQuoted) {
      value = value.slice(1, -1);
    } else {
      // An unquoted trailing comment is a comment, not part of the value.
      const comment = value.indexOf(' #');
      if (comment >= 0) {
        value = value.slice(0, comment).trim();
      }
    }

    values[key] = value;
  });

  return values;
};

const loadDotenv = (fileName = '.env') => {
  const filePath = path.join(webpackPaths.rootPath, fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  Object.entries(parse(fs.readFileSync(filePath, 'utf8'))).forEach(
    ([key, value]) => {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    },
  );
};

export { parse };
export default loadDotenv;
