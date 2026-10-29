# Adding a style

This guide takes you from `printshop new-style` to a built image.
It uses the two packs that ship with printshop, the zine pack and the collage pack, as examples.
Read [the process](process.md) first.
It says how to measure a reference and how to settle a design before you build.

The guide uses a pack named `riso-test`.
Use your own name.
A pack name uses lowercase letters, digits and single dashes, and starts with a letter.

## What you need

- A project with printshop as a dependency, and Chromium installed.
  [The README](../README.md#install) shows how.
- Node.js 22.2.0 or newer.

Run every command in the root folder of your project.

## 1. Make the pack

```sh
npx printshop new-style riso-test
```

The command copies the template into `packs/riso-test`.
It refuses a name that a pack of printshop uses already, and a folder that exists already.
If your project is not an ES module project, it also writes `packs/package.json` with `"type": "module"`, because a pack is made of ES modules.

The pack has these files:

| File | What it does |
| --- | --- |
| `index.js` | The pack: name, version, filters, presets, assets, checks and examples. |
| `filter.js` | The look: an ordered list of filter steps, and one step of its own as an example. |
| `example/page.html` | The example layout. |
| `example/page.png` | The golden image of the example. |
| `pack.test.js` | The golden test. |
| `README.md` | A short guide for the pack. |

## 2. Build the example

```sh
npx printshop build packs/riso-test/example/page.html
```

The command renders the page, prints it through the filters of the pack, runs the checks and writes `out/page.png`.
Open the image.
You now have a working style, and each next section changes one part of it.

Run the test of the pack:

```sh
node --test packs/riso-test/pack.test.js
```

The test builds every example again.
It compares each result with its golden image.
It passes now, because the template ships its golden image.
It will fail when your changes alter the picture, and that is the point of it.
Section 9 shows how to accept a change that you meant to make.

## 3. The layout

A layout is an HTML page.
The core renders it with Chromium, so you can use any CSS that Chromium knows.
Three rules apply:

- The page has an element with the id `page`.
  The core takes the screenshot of this element.
  The width comes from the preset, and the height comes from the element.
- The page sets the attribute `data-ready` on the body when it is ready.
  Wait for fonts and images first.
  The example page does it with `document.fonts.ready.then(() => document.body.setAttribute('data-ready', ''))`.
  Without the attribute, the build waits 30 s and fails with a message.
- Use only shapes, or fonts that the pack ships.
  The page then renders the same on every machine.

A page can mark elements for the filter:

- `data-clean`, `data-soft` and `data-nospeck` mark calm zones.
  In a calm zone, a filter step is weaker or off, so small type keeps its strokes.
  `data-nospeck` keeps specks out, `data-soft` also softens the ink bleed and the dot screen, and `data-clean` lowers the bleed more and swaps the dot screen for a plain threshold.
- `data-box="name"` names the box of an element.
  The build code can read it, for example to check that nothing touches the header.

The core also passes `?layer=...` to the page and `window.PAGE_DATA` when a build asks for it.
The zine pack uses layers to print the letters of a title one by one.

### A layout made in code

The collage pack does not draw an HTML page by hand.
`examples/collage/scene.js` makes the layout in code.
It puts pieces of paper on a stack: sheets, tiles, mats, motifs and tape.
`examples/collage/build.js` renders the scene and returns the image with its checks.

An example names such a module as its `build`.
The default export of that module is a function:

```js
export default async function build(renderer, { seed, filter }) {
  // Render the layout, run the filter, run the checks of the layout.
  return { image, checks };
}
```

The runner calls it with the seed of the example and the filter options of its preset.

The zine pack has a third way.
It has kinds of its own: a still `page` and an animated `ransom-title`.
The pack module exports `buildExample(renderer, example)`, and the example names its `kind`.
`printshop build --kind ransom-title` builds that kind.

A build picks the first way that fits:

1. The example names a `build` module.
2. The pack module exports `buildExample`.
3. The layout is an HTML file, and the build runs it through the `filters` of the pack.

The template uses the third way.
That is the simplest one, and it is enough for most styles.

## 4. Filter steps

The look of a pack is an ordered list of filter steps.
A step is an object with three fields:

```js
{
  name: 'grain',
  defaults: { grain: { amount: 0.18, cell: 3 } },
  run(work, options, streams) {
    // Read and change work.gray, and draw random values from a named stream.
  },
}
```

- `name` is the name of the step.
- `defaults` holds the options that the step reads, with their default values.
- `run` changes the shared `work` record.
  `work.gray` holds the gray values from 0 to 1.
  The last step of a chain must set `work.out`, which holds black or white for each pixel.
  The threshold step of the core does that, and so does the dot screen of the collage pack.

`runFilter(steps, image, options)` runs the steps in order.
The options are the defaults of all the steps, then your `options` on top (a shallow merge).
`withDefaults(step, defaults)` copies a step with other defaults.

The core has the general steps in `@tranbao0/printshop/core/filters`:

| Step | What it does |
| --- | --- |
| `grayStep` | Turns the RGBA input into gray values and alpha. |
| `contrastStep` | Sets the slope around mid gray. |
| `zonesStep` | Builds the calm-zone masks from the marks of the page. |
| `bleedStep` | Moves the gray values along noise, so edges turn uneven, like ink that bleeds. |
| `thresholdStep` | Cuts the gray values to black and white, with a jittered level. |
| `levelsStep` | Snaps the output to the allowed levels. |

A pack adds the steps that make its look.

- The zine pack runs gray, contrast, zones, bleed, then four steps of its own: `toner` (weak patches and drum streaks), `halftone` (a dot screen), `specks.black`, `specks.white` and `hairs`.
  Then it runs levels.
- The collage pack runs gray, contrast, bleed, then one step of its own, `screen` (a clustered-dot halftone), and levels.
- The template runs gray, contrast, `grain`, threshold and levels.

### Try it: add a step

Open `packs/riso-test/filter.js`.
Add a step before `lookSteps`.
It darkens a few whole rows, like a worn scanner bar:

```js
/** @type {import('@tranbao0/printshop/core/filters').FilterStep<{ seed: number, scan: { density: number, strength: number } }>} */
export const scanStep = {
  name: 'scanlines',
  defaults: { scan: { density: 0.12, strength: 0.35 } },
  run(work, o, streams) {
    for (let y = 0; y < work.height; y++) {
      if (streams.stream('scanlines', y)() >= o.scan.density) continue;
      for (let x = 0; x < work.width; x++) work.gray[y * work.width + x] *= 1 - o.scan.strength;
    }
  },
};
```

Then put it in the list, after `grainStep` and before the threshold:

```js
export const lookSteps = [
  grayStep,
  withDefaults(contrastStep, { contrast: lookDefaults.contrast }),
  grainStep,
  scanStep,
  withDefaults(thresholdStep, { threshold: lookDefaults.threshold, edgeNoise: lookDefaults.edgeNoise }),
  withDefaults(levelsStep, { levels: lookDefaults.levels }),
];
```

Build again and look at the image.
Fine rows of light lines now cut through the light grays.

```sh
npx printshop build packs/riso-test/example/page.html --out out/scanlines.png
```

The test of the pack now fails, because the image is not the golden image any more.
That is correct.
Section 9 shows how to accept the new image.

## 5. Seed streams

A style must give the same image for the same input and the same seed.
It must also keep its random features where they are when one part of the picture changes.
Two rules give you both.

1. Never call `Math.random`.
   Every random draw comes from a named stream of the image seed.
2. Give each purpose its own stream.
   Use `streams.stream(name, index)` for a sequence of draws, and `streams.key(name, index)` for the key of a noise field.
   The index gives one stream to each item, such as a row, a band or a piece.

The scanline step above draws one number from the stream `scanlines` with the row as the index.
A change to another step cannot re-roll the rows.
A taller page keeps the rows of a shorter page.

The packs follow the same rules:

- The zine pack has the streams `wobble`, `edges`, `patches`, `grain`, `streaks`, `specks.black`, `specks.white` and `hairs`.
  It cuts the page into tiles of 64 px and gives each tile its own stream for specks and hairs.
  A taller or wider page keeps the specks of the part it shares with a smaller page.
  The page parts that run in the browser (`packs/zine/parts.js`) use the same hashes, so a letter of a title does not change when another letter changes.
- The collage pack gives each piece its own streams: `edges.<piece>`, `motif.<piece>`, `holder.<piece>` and `tape.<piece>`.
  A new piece never changes the outline of another piece.

The seed comes from the example, from the preset, or from `--seed`:

```sh
npx printshop build packs/riso-test/example/page.html --seed 3 --out out/seed-3.png
```

Build it twice with the same seed.
The two files are the same.
Another seed gives another picture.

## 6. Presets

A preset is a named set of options for a common output, such as a page, a card or a tag.
It has a `width` in pixels, an optional `seed`, and an optional `filter` object that overrides the defaults of the steps.

- The zine pack has one preset, `page`, for a width of 1600 px.
  Its page layouts are drawn in pixels for that width.
- The collage pack has one preset, `card`, for a width of 800 px.
  It sets the contrast of the filter.

Add a preset to `index.js` of your pack:

```js
presets: {
  page: { width: 800, seed: 1, filter: { contrast: lookDefaults.contrast } },
  card: { width: 400, seed: 2, filter: { contrast: 1.5, scan: { density: 0.2, strength: 0.4 } } },
},
```

Build with it by name: `npx printshop build packs/riso-test/example/page.html --preset card --out out/card.png`.
Without `--preset`, the build uses the preset of the example, then `page`, then the first preset.

## 7. Assets and licenses

A pack lists the fonts and textures that it ships in `assets`.
Each asset has a name, a kind, the path of its file, the SPDX name of its license, and the path of the license text.
All paths are relative to the folder of the pack.

The zine pack ships six fonts.
Alfa Slab One, Anton, Archivo Black and Rubik Mono One use `OFL-1.1`.
Permanent Marker and Special Elite use `Apache-2.0`.
Each font sits in its own folder with its license file, and `zine.css` loads them with `@font-face`.
Its test checks that every font has a license file and that every font file is listed.
The collage pack ships no asset, because its pieces are drawn in code.

Add a font to your pack.
Use a font with an open license, and keep its license file next to it.
This example copies Anton, with its license, from the zine pack:

```sh
mkdir -p packs/riso-test/fonts/anton
cp node_modules/@tranbao0/printshop/packs/zine/fonts/anton/Anton-Regular.ttf node_modules/@tranbao0/printshop/packs/zine/fonts/anton/OFL.txt packs/riso-test/fonts/anton
```

List it in `index.js`:

```js
assets: [
  { name: 'Anton', kind: 'font', file: 'fonts/anton/Anton-Regular.ttf', license: 'OFL-1.1', licenseFile: 'fonts/anton/OFL.txt' },
],
```

Load it in `example/page.html`, and use it:

```html
<style>
  @font-face { font-family: "Anton"; src: url("../fonts/anton/Anton-Regular.ttf"); }
  .label { left: 480px; top: 80px; font: 64px "Anton", sans-serif; }
</style>
...
<div class="shape label">NO. 1</div>
```

The test of the pack checks that the font file and the license text exist.
Never add a font, an image or a texture without a license that allows it.

## 8. Checks

A pack has checks at two levels.

The checks of the pack run over every image that it builds.
They are the `checks` function of the pack.
It gets the PNG, its width and its height, and it returns a list of results.
A result is `{ name, ok, message }`.
The core has checks that you can reuse in `@tranbao0/printshop/core/checks`:
`checkSize` for a size budget, `checkColourCount`, `checkDimensions`, `checkCoverage`, `checkSlivers` and `checkToneOrder`.

- The zine pack checks the size of the PNG against a budget (450 000 bytes for a page, 200 000 bytes below 1600 px), and that the PNG has at most four colours.
  An animated title has its own budget, and a check that the SVG holds no script, no event handler and no external reference.
- The collage pack checks the size (200 KiB), and that the PNG has at most four colours.

The checks of the layout run while the layout is built, and the build module returns them with the image.
The collage pack has the largest set:

| Check | Fails when |
| --- | --- |
| `checkMarks` | A mark lies outside its piece, too near its cut edge, or under a later piece. |
| `checkMotifs` | A motif has no holder, casts a shadow, or lies too near the edge of its holder. |
| `checkShown` | A piece is mostly buried under later paper, or lies mostly off the page. |
| `checkSheetSlivers` | A sheet shows as a band thinner than 8 px. |
| `checkProbe` | A pixel of a magenta probe render shows no paper. |
| `checkTones`, `checkRamp`, `checkNeighbours` | Gray papers print alike where they should differ. |

Every check has a test that feeds it a bad input and expects it to fail.
Do the same for your checks.
A check that never fails tests nothing.

Add a check to your pack.
It must keep the share of black ink between 3 and 60 percent, so that a page is neither blank nor a black block:

```js
function checkInk(name, gray) {
  let black = 0;
  for (const value of gray) if (value === 0) black++;
  const share = black / gray.length;
  const ok = share >= 0.03 && share <= 0.6;
  return { name, ok, message: `${(share * 100).toFixed(1)} percent black${ok ? '' : ', outside 3 to 60 percent'}` };
}
```

Call it from `checks` in `index.js`, with the gray values from `decodeGrayPng`:

```js
checks: async ({ png }) => {
  const { colours, gray } = await decodeGrayPng(png);
  return [checkSize('png size', png.length, SIZE_BUDGET), checkColourCount('png colours', colours, 2), checkInk('png ink', gray)];
},
```

A build prints the checks that fail, and exits with 1.
Use `--verbose` to see them all.

A check serves the request of the person you build for.
When a check conflicts with the request, follow the request.
[The process](process.md#the-rule-the-request-beats-your-own-check) explains why.

## 9. Examples and golden images

An example is an input that the golden test builds.
It has a name, an input, a preset, a fixed seed and the path of its golden image.
The paths are relative to the folder of the pack.

```js
examples: [
  { name: 'page', input: 'example/page.html', preset: 'page', seed: 1, golden: 'example/page.png' },
],
```

The zine pack has two examples: `examples/zine-page/page.html` and the animated title `examples/ransom-title/title.html`.
The collage pack has one: the scene in `examples/collage/scene.js`.
Their pictures are in the README.

A golden image is the stored output of an example.
The test of the pack builds the example again and compares the new image with the stored one.
The zine pack compares pixel for pixel.
The collage pack allows almost no difference: at most 0.02 percent of the pixels, and at most 10 in any window of 16 px, so a lost mark or a lost motif still fails.
The template allows the same small difference, because the anti-aliasing of text can differ a little between builds of Chromium.

Two rules keep golden images honest:

- Only `UPDATE_GOLDENS=1` changes a golden image.
  `printshop build` never writes over the golden image of a pack.
  It stops with a message if `--out` names one.
- Look at the new image before you keep it.
  A golden image that you did not look at proves nothing.

You changed the look in section 4.
Look at `out/scanlines.png`.
If it is what you meant, accept it:

```sh
UPDATE_GOLDENS=1 node --test packs/riso-test/pack.test.js
node --test packs/riso-test/pack.test.js
```

The first command writes the new golden images.
The second command shows that the test passes against them.

To add a second example, such as the `card` preset, make its golden image first.
Build it to the path of the golden image, before you list the example:

Run `npx printshop build packs/riso-test/example/page.html --preset card --out packs/riso-test/example/card.png`.

Then add the example to `examples` in `index.js`, with `golden: 'example/card.png'`.
The test of the pack now builds both examples.

## 10. Check that you are done

1. `printshop build` on your example exits with 0 and writes an image that you looked at.
2. The test of your pack passes.
3. Every random draw comes from a named stream, and none from `Math.random`.
4. Every font and texture is listed in `assets`, with its license file next to it.
5. Each check of yours has a test that makes it fail.
6. Your project passes its own type check and tests.
   The pack imports the core as `@tranbao0/printshop/core/...`, so the project needs the package as a dependency.

When these hold, review the change as [the process](process.md#5-review) says.
