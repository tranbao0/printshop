// Tells a script whether it was started as the program (`node script.js`) and not imported by another module.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Use it as `if (isMainModule(import.meta.url)) { ... }`, so that importing a script never runs it.
 * (`import.meta.main` needs Node 24; the package supports Node 22.11 and newer.)
 * @param {string} moduleUrl The `import.meta.url` of the script.
 * @param {string | undefined} [entry] The file that Node started. Default: `process.argv[1]`.
 * @returns {boolean}
 */
export function isMainModule(moduleUrl, entry = process.argv[1]) {
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
