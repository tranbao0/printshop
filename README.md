# printshop

Turns layouts into print-look images: photocopied zine pages, paper collages, ransom-note titles, and animated SVGs that play inside GitHub.

Status: early.
This release holds the style-neutral core.
Style packs, the command-line tool and the full docs follow.

## The core

The core lives in `src/core/`.
It is plain JavaScript (ES modules) with JSDoc types, checked by `tsc` in strict mode.

| Module | What it does |
| --- | --- |
| `render.js` | Renders an HTML page to pixels with headless Chromium (Playwright). |
| `filters.js` | A chain of small, seeded filter steps over an RGBA buffer, and the steps of the photocopy look. |
| `zones.js` | Calm zones: areas where a filter step is weaker or off. |
| `noise.js` | Smooth noise fields for the filter steps. |
| `encode.js` | Indexed palette PNG encoding, decoding, and layer helpers. |
| `pipeline.js` | Page to filtered image to encoded file. |
| `svg-anim.js` | Per-piece animated SVG parts: stop-motion keyframes, reduced motion, tiles. |
| `checks.js` | Output checks: size, dimensions, colour count, coverage, slivers, tonal gap. |
| `seed.js` | Seeded random streams. |
| `types.js` | The style pack contract. |

## Seeded randomness

Every random draw comes from a named stream, such as `specks`, `edges` or `wobble`.
A stream depends only on the image seed, its name and an optional index.
A change in one part of an image does not re-roll the random features of another part.

## Develop

You need Node.js 22 or newer.

```sh
npm ci --ignore-scripts
npx playwright install --with-deps --only-shell chromium
npx tsc -p .
node --test
```

## License

MIT, see `LICENSE`.
