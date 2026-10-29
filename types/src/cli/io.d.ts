export type Io = {
    /**
     * Writes a line to standard output.
     */
    out: (text: string) => void;
    /**
     * Writes a line to standard error.
     */
    err: (text: string) => void;
    cwd: string;
    env: Record<string, string | undefined>;
};
/**
 * @typedef {object} Io
 * @property {(text: string) => void} out Writes a line to standard output.
 * @property {(text: string) => void} err Writes a line to standard error.
 * @property {string} cwd
 * @property {Record<string, string | undefined>} env
 */
/** A mistake in how the tool is called. The tool shows the message and the help, and exits with 2. */
export declare class UsageError extends Error {
    /** @param {string} message */
    constructor(message: string);
}
/**
 * Parses the arguments of a command. An unknown option or a missing value is a `UsageError`.
 * @template {import('node:util').ParseArgsConfig['options']} O
 * @param {string[]} args
 * @param {O} options
 * @returns {{ values: import('node:util').ParseArgsConfig extends any ? Record<string, any> : never, positionals: string[] }}
 */
export declare function parse<O extends import('node:util').ParseArgsConfig['options']>(args: string[], options: O): {
    values: import('node:util').ParseArgsConfig extends any ? Record<string, any> : never;
    positionals: string[];
};
/**
 * Reads a whole number option.
 * @param {string} name The option, for the message.
 * @param {string | undefined} text
 * @param {{ min?: number }} [limits]
 * @returns {number | undefined}
 */
export declare function wholeNumber(name: string, text: string | undefined, { min }?: {
    min?: number;
}): number | undefined;
/**
 * Reads a number option.
 * @param {string} name
 * @param {string | undefined} text
 * @returns {number | undefined}
 */
export declare function number(name: string, text: string | undefined): number | undefined;
/**
 * A path for a message: relative to the working folder, or absolute if the file is outside it.
 * @param {string} cwd
 * @param {string} file
 */
export declare function shown(cwd: string, file: string): string;
/**
 * JSON with two-space indentation, in which a short list of numbers, such as a point, stays on one line.
 * @param {unknown} value
 */
export declare function formatJson(value: unknown): string;
