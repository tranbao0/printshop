/** The error for a missing or broken ffmpeg. The command-line tool shows its message as it is. */
export declare class FfmpegError extends Error {
    /** @param {string} message */
    constructor(message: string);
}
/**
 * Finds ffmpeg: the file that the `FFMPEG` environment variable names, or `ffmpeg` on `PATH`.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<string>} The path of the program.
 * @throws {FfmpegError} With a message that tells what to do, if there is no ffmpeg.
 */
export declare function findFfmpeg(env?: Record<string, string | undefined>): Promise<string>;
/**
 * Runs ffmpeg and collects its output.
 * @param {string} ffmpeg
 * @param {string[]} args
 * @returns {Promise<{ code: number | null, stdout: Buffer, stderr: string }>}
 */
export declare function runFfmpeg(ffmpeg: string, args: string[]): Promise<{
    code: number | null;
    stdout: Buffer;
    stderr: string;
}>;
/**
 * The last lines of the output of ffmpeg, for an error message.
 * @param {string} stderr
 */
export declare const tail: (stderr: string) => string;
