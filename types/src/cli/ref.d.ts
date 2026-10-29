export declare const summary = "Reference tools: a frame sheet from a video, registration of a screenshot, tracing of marks.";
export declare const help = "Usage: printshop ref <tool> [options]\n\nTools:\n  frames <video>                  A sheet of frames from a video, with the frame numbers. Needs ffmpeg.\n  register <screenshot> <image>   The scale and the offset that match a screenshot to an image.\n  trace <screenshot> --fit <file> The coloured marks of a registered screenshot, in the coordinates of the image.\n\nRun \"printshop ref <tool> --help\" for the options of a tool.";
/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
export declare function run(args: string[], io: import('./io.js').Io): Promise<number>;
