export declare const summary = "Make a new style pack from the template, with an example, a preset, a golden test and a README.";
export declare const help = "Usage: printshop new-style <name> [options]\n\nCopies the template pack into packs/<name>, in the current folder.\nThe new pack builds its example and passes its own test as it is:\n\n  printshop new-style riso-test\n  printshop build packs/riso-test/example/page.html\n  node --test packs/riso-test/pack.test.js\n\nThe name uses lowercase letters, digits and single dashes, and starts with a letter.\nA pack imports the core by the name of the package, @tranbao0/printshop, so the project needs the package as a dependency.\n\nOptions:\n      --dir <folder>   The folder of the project. The pack goes into <folder>/packs/<name>. Default: the current folder.\n  -h, --help           Show this help.";
/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
export declare function run(args: string[], io: import('./io.js').Io): Promise<number>;
