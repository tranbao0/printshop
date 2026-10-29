/**
 * Runs the tool.
 * @param {string[]} argv The arguments after the name of the program.
 * @param {Partial<import('./io.js').Io>} [overrides]
 * @returns {Promise<number>} The exit code: 0 for success, 1 for a failure or a failed check, 2 for a mistake in the call.
 */
export declare function main(argv: string[], overrides?: Partial<import('./io.js').Io>): Promise<number>;
