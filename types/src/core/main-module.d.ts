/**
 * Use it as `if (isMainModule(import.meta.url)) { ... }`, so that importing a script never runs it.
 * (`import.meta.main` needs Node 24; the package supports Node 22.11 and newer.)
 * @param {string} moduleUrl The `import.meta.url` of the script.
 * @param {string | undefined} [entry] The file that Node started. Default: `process.argv[1]`.
 * @returns {boolean}
 */
export declare function isMainModule(moduleUrl: string, entry?: string | undefined): boolean;
