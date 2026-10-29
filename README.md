# printshop

Turns layouts into print-look images: photocopied zine pages, paper collages, ransom-note titles, and animated SVGs that play inside GitHub.

Status: early.
This release holds the style-neutral core, the zine pack, the collage pack and the command-line tool.
The full docs follow.

## The core

The core lives in `src/core/`.
It is plain JavaScript (ES modules) with JSDoc types, checked by `tsc` in strict mode.

| Module | What it does |
| --- | --- |
| `render.js` | Renders an HTML page to pixels with headless Chromium (Playwright). |
| `filters.js` | A chain of small, seeded filter steps over an RGBA buffer, and the general steps: gray, contrast, calm zones, ink bleed, threshold, levels. |
| `zones.js` | Calm zones: areas where a filter step is weaker or off. |
| `noise.js` | Smooth noise fields for the filter steps. |
| `scatter.js` | Tiles for random features with a place in the image (specks, hairs, streaks). |
| `encode.js` | Indexed palette PNG encoding, decoding, and layer helpers. |
| `pipeline.js` | Page to filtered image to encoded file. |
| `svg-anim.js` | Per-piece animated SVG parts: stop-motion keyframes, reduced motion, tiles. |
| `checks.js` | Output checks: size, dimensions, colour count, coverage, slivers, tonal gap, tone order. |
| `seed.js` | Seeded random streams. |
| `golden.js` | Golden image comparison for the tests of a pack. |
| `pack-runner.js` | Finds packs and builds their examples. |
| `ref/` | The reference tools: frame sheets, registration of a screenshot, tracing of marks. |
| `types.js` | The style pack contract. |

## The zine pack

The zine pack lives in `packs/zine/`.
It holds the photocopy look (halftone, toner, drum streaks, specks, hairs), the page parts for zine layouts, six fonts with their license files, and the animated ransom-letter title.

| File | What it does |
| --- | --- |
| `index.js` | The pack: filter steps, presets, fonts with licenses, checks, examples (`buildExample` builds one) and size budgets. The page layouts are drawn for 1600 px, so `page` is the only preset. |
| `photocopy.js` | The photocopy look, built from the steps of the core. |
| `zine.css` and `parts.js` | A page loads these. `parts.js` draws torn and cut paper, tape, track labels, worn stamps, burnt sheets and cut-out letter tiles. |
| `ransom-svg.js` | The animated title: entrance, flips, hops and rests, all driven by options. |
| `build.js` | `buildPage` and `buildRansomTitle`: render a layout, run the photocopy look, encode, and run the checks. |
| `checks.js` | The size budgets, and the check that an animated SVG has no script and no external reference. |
| `frames.js` | Shows an animated SVG at chosen times, to check its motion. |

Two examples show the pack. Run them from the root of the repository:

```sh
node examples/zine-page/build.js
node examples/ransom-title/build.js
```

The first writes `examples/zine-page/page.png`.
The second writes `examples/ransom-title/title.svg` and `title-still.png`.
The stored outputs are the golden images of the tests.

## The command-line tool

The package has one command, `printshop`, in `bin/printshop.js`.
A project that has the package as a dependency runs it as `npx printshop`.
In this repository, run `node bin/printshop.js` for `printshop` in the examples below.
Headless Chromium must be installed (`npx playwright install chromium`).

```sh
printshop build examples/zine-page/page.html
printshop build examples/ransom-title/title.html
printshop build examples/collage/scene.js
printshop new-style riso-test
printshop ref frames video.mp4
printshop ref register screenshot.png image.png --out fit.json
printshop ref trace screenshot.png --fit fit.json
```

`printshop build <input>` builds an image from a layout and runs the checks of the pack.
The input is an HTML file, or the layout of an example that is made in code (a pack example with a `build` entry).
An HTML page needs an element with the id `page`, and it sets the attribute `data-ready` on the body when it is ready.
A `.js` file that no pack names as an example is refused, because the build would run its code.
Add `--module` to build a module of your own whose default export is a build function.
It writes `out/<name>.png`, or `out/<name>.svg` and `out/<name>-still.png` for an animated title, and exits with 1 if a check fails.
Run from the root of this repository, the three examples above build the images of the golden tests.
The command does not write over the golden image of any pack.
A golden image changes only when a pack test runs with `UPDATE_GOLDENS=1` (or `true`).

`printshop new-style <name>` copies `templates/pack` to `packs/<name>`, with an example layout, a preset, a golden test and a README.
The new pack builds its example and passes its own test as it is:

```sh
printshop build packs/riso-test/example/page.html
node --test packs/riso-test/pack.test.js
```

`printshop ref` holds the reference tools.
`frames` makes a sheet of numbered frames from a video.
`register` finds the scale and the offset that match a screenshot to an image.
`trace` takes the marks of one colour, such as red lines, out of a registered screenshot and maps them into the coordinates of the image.
`frames` needs `ffmpeg`, from `PATH` or from the `FFMPEG` environment variable.
The tool says so, and exits with 1, if there is none.
Run `printshop <command> --help` for the options.

## Seeded randomness

Every random draw comes from a named stream, such as `specks`, `edges` or `wobble`.
A stream depends only on the image seed, its name and an optional index.
A change in one part of an image does not re-roll the random features of another part.

Features with a place in the image keep their place when the image grows.
A noise value is a hash of the key of its field and the position of its grid point.
Specks, hairs and drum streaks come from one stream per tile of a fixed grid, and the grid starts at the top-left corner of the image.
A taller or wider page keeps the features of the part it shares with a smaller page.
Only the pixels that a new feature can reach change: the edge of the old image (the ink bleed samples the pixels around it)
and the few pixels that a speck at the new edge stamps into the old part.
The grid is anchored at the top-left corner, so a feature does not keep its place when content is added above or to the left of it.

## Develop

You need Node.js 22.2.0 or newer (`encode.js` uses `crc32` from `node:zlib`, which Node.js has since 22.2.0).
CI tests 22.2.0 and 24.

```sh
npm ci --ignore-scripts
npx playwright install --with-deps --only-shell chromium
npx tsc -p .
node --test
```

## License

MIT, see `LICENSE`.
