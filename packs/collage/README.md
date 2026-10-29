# Collage pack

Paper collage parts: scissor-cut and torn sheets, drop shadows, motifs that lie flat on holding pieces, tape, mats, a halftone print look and the checks that keep a collage honest.
The pack holds only general parts.
The picture in `examples/collage/` is made of plain shapes and motifs.

## Model

A collage is a paste stack: pieces of paper in the order they are pasted, bottom first (`scene.js`).
`createScene` collects the pieces and `build()` makes their outlines.
Every random draw comes from a named stream of the scene seed (`edges.<piece>`, `motif.<piece>`, `holder.<piece>`, `tape.<piece>`).
A new piece never changes the outline of another one.

| Piece | Meaning |
| --- | --- |
| `base` | A safety sheet under everything. No pixel of the page may show it. |
| `sheet` | A large sheet with `cut`, `torn` or `clean` edges and an optional pattern. |
| `tile` | A scissor-cut piece that carries marks. Tile and marks turn together. |
| `mat` | Paper a little larger than a tile, pasted just under it. |
| `motif` | A snowflake (V branches), sparkle, burst (never five points), crescent or note. It lies flat and casts no shadow. |
| holder | The piece that holds a motif and casts the shadow. `motif()` adds it under the motif. |
| `tape` | A see-through strip. |

## Checks

`checks.js` holds the checks.
A check returns `CheckResult` values and never runs the print filter.
The checks over a printed image take the print of the paper alone (render with `paper: true`, then filter).

| Check | Fails when |
| --- | --- |
| `checkMarks` | A mark lies outside its piece, too close to its cut edge, or under a later piece, shadow or tape. |
| `checkMotifs` | A motif has no holder, casts a shadow, or lies too close to the edge of its holder. |
| `checkShown` | A piece is mostly buried under later paper, shadows or tape. |
| `checkSheetSlivers` | A sheet shows as a band thinner than 8 px. |
| `checkBase` | The safety sheet shows. |
| `checkProbe` | A pixel of a magenta probe render shows no paper. |
| `checkShadows` | A motif casts a shadow, prints like its holder, or the holder's shadow does not show. |
| `checkTones` | A tile prints as dark as the darkest tiles, or darker. |
| `checkRamp`, `checkNeighbours` | Gray papers that print alike are next to each other in the palette or on the page. |

`buildCollage(renderer, scene, { darkest })` renders a scene, prints it and runs every check.

## Example

`node examples/collage/build.js` builds `examples/collage/collage.png` and prints every check.
The layout is `examples/collage/scene.js`; `packs/collage/page.html` is the host page that shows it.
To update the golden image after a change that is meant to alter the picture, look at the new image and run `UPDATE_GOLDENS=1 node --test test/packs/collage.test.js`.
