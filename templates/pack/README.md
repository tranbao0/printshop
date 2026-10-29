# __PACK_NAME__

A style pack for printshop.
It was made by `printshop new-style __PACK_NAME__`.
It builds its example and passes its own test as it is.
Change the look, the example and the golden image to make your style.

## Try it

Run these commands in the folder of the project that holds `packs/`:

```sh
printshop build packs/__PACK_NAME__/example/page.html
node --test packs/__PACK_NAME__/pack.test.js
```

The first command renders the example page, prints it through the filters of the pack, runs the checks and writes `out/page.png`.
The second command builds every example again and compares the result with its golden image.

## Files

| File | What it does |
| --- | --- |
| `index.js` | The pack: name, version, filter steps, presets, assets, checks and examples. The shape is the `StylePack` type of printshop (`src/core/types.js`). |
| `filter.js` | The look: an ordered list of filter steps. It uses the steps of the core and has one step of its own, `grainStep`. |
| `example/page.html` | The example layout. The core renders the element `#page` and waits for the attribute `data-ready` on the body. |
| `example/page.png` | The golden image of the example. |
| `pack.test.js` | The golden test. |

The pack imports the core as `@tranbao0/printshop/core/...`, so the project needs `@tranbao0/printshop` as a dependency.

## Make it your own

1. Change the steps in `filter.js`.
   A step is `{ name, defaults, run(work, options, streams) }`.
   Draw every random value from a named stream, for example `streams.key('grain')`, and never from `Math.random`.
   Then a change in one step does not re-roll the random features of another.
2. Add presets in `index.js` for the outputs that you need (a card, a tag, an avatar).
   A preset has a `width` and may override the options of the steps in `filter`.
3. Change `example/page.html` to show the look.
   Use only shapes, or fonts that the pack ships with their license files, so that the page renders the same on every machine.
   List a font or a texture in `assets` with its license.
4. Build again, look at the image, and keep it as the new golden image:

   ```sh
   UPDATE_GOLDENS=1 node --test packs/__PACK_NAME__/pack.test.js
   ```

5. Add checks to `checks` in `index.js` for the faults that your style can have, such as a size budget or a colour count.

An example can also name a `build` module for a layout that is made in code, or a pack can export `buildExample` for kinds of its own.
Both are described in `src/core/types.js` of printshop, and the zine and collage packs use them.
