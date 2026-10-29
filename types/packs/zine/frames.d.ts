/**
 * Takes a PNG of the SVG at each time.
 * @param {string} svg The SVG document.
 * @param {number[]} times Seconds from the start of the cycle.
 * @param {{ width: number, height: number }} size The size of the SVG.
 * @param {{ reducedMotion?: boolean }} [options] `reducedMotion` loads the page as a reader who asks for less motion.
 * @returns {Promise<Buffer[]>}
 */
export declare function svgFramesAt(svg: string, times: number[], { width, height }: {
    width: number;
    height: number;
}, { reducedMotion }?: {
    reducedMotion?: boolean;
}): Promise<Buffer[]>;
