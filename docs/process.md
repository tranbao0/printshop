# The process

Every style in printshop follows the same method.
It has five steps: measure the reference, settle the design, build, run the checks, and review.
The method works for a new style, and it works for one image in an existing style.

One rule sits above all five steps.
A request from the person you build for beats a check that you made yourself.
The last section explains the rule.

## 1. Measure the reference first

Start from what exists.
The reference can be a screenshot, a still, or a video.
Measure it before you build anything.
Trace its shapes, its positions and its proportions from the pixels.
Build from those numbers.
Do not guess a shape from a description, and do not tune a shape only by eye.

The `printshop ref` tools do the measuring.
The examples below use three files that stand for your own reference files.
`reference.mp4` is a video, `reference.png` is a still image, and `screenshot.png` is a screenshot of that image with marks drawn over it.

### Frames of a video

`printshop ref frames` makes one sheet of numbered thumbnails from a video.
Each thumbnail shows its frame number and its time.
The first frame is frame 0.
Use the sheet to pick the frames that you want to study, then ask for those frames.
It needs `ffmpeg`.

<!-- docs-check: ffmpeg -->
```sh
npx printshop ref frames reference.mp4
npx printshop ref frames reference.mp4 --frames 0,5,10 --cols 3 --out out/chosen-frames.png
```

### Register a screenshot to an image

A screenshot of an image is scaled and moved.
It often has a margin around it, and marks that you drew over it.
`printshop ref register` finds the scale and the offset that match the screenshot to the image.
It writes them as JSON.
The `score` in the JSON tells how well the two match.
The command fails if the score is below 0.5, so a wrong pair does not give a quiet wrong answer.

```sh
npx printshop ref register screenshot.png reference.png --out fit.json
```

After that, a point in the screenshot is a point in the image, with this rule:
`x = (px - ox) / sx` and `y = (py - oy) / sy`.

### Trace marks

Draw the marks that you want to measure over the screenshot in one clear colour, such as red.
Draw the outline of a shape, the position of a part, or a line that shows the angle of an edge.
`printshop ref trace` finds the marks of that colour and maps them into the coordinates of the image.
For each mark it gives a polyline in image pixels.
With `--image` and `--overlay` it also draws the paths over the image, so that you can see that the trace is right.

```sh
npx printshop ref trace screenshot.png --fit fit.json --image reference.png --overlay out/trace.png --out out/marks.json
```

Look at `out/trace.png`.
If the paths do not lie on the shapes, the registration or the colour threshold is wrong.
Fix that before you use the numbers.

### Write the numbers down

Keep the measured numbers in the project.
A layout then reads them, or a comment next to them says where they came from.
A later change can measure again and compare.

## 2. Settle the design, one decision at a time

A design has many decisions: the size, the paper, the ink, the layout, the parts, the motion.
Take them one at a time.
Raise one topic.
Wait for the decision of the person you build for.
Then move to the next topic.
Do not bundle several choices into one question.

Write each decision down when you get it.
A short list of settled decisions saves you from asking the same question twice.
It also shows later which choices were made on purpose.

Start from how the person thinks about the work.
Do not let the wording of an earlier decision, a data source, or a limit of the tools decide the structure of the design.

## 3. Build

1. Choose the pack.
   Use the zine pack or the collage pack if the look is close to one of them.
   Make a new style if it is not.
   [Adding a style](adding-a-style.md) shows how.
2. Make the layout, as an HTML page or as code.
3. Build it with a fixed seed:

   ```sh
   npx printshop build node_modules/@tranbao0/printshop/examples/zine-page/page.html --seed 7 --out out/zine-seed-7.png
   ```

4. Look at the image at its full size.
   Put the reference next to it.
5. Change the layout or the options, and build again.

A fixed seed gives the same image on every run.
Every random draw comes from a named stream, so a change in one part of the image does not re-roll the random features of another part.
You can fix one part of the picture and then work on the next.

## 4. Run the checks

`printshop build` runs the checks of the pack after every build.
It prints the checks that fail.
It exits with 1 if one fails.
Add `--verbose` to see every check.

```sh
npx printshop build node_modules/@tranbao0/printshop/examples/collage/scene.js --verbose
```

The checks catch the faults that the eye misses in a quick look:

- The file is over its size budget, or it has too many colours.
- A mark is hidden under paper, or it sits too near a cut edge.
- A thin sliver of a sheet shows.
- A gap in the paper shows the safety sheet.
- Two papers print alike where they touch.
- An animated SVG holds a script or an external reference.

The tests of a pack compare every example with its golden image.
The tests of the zine and collage packs run in the printshop repository, and not in your project.
For a pack of your own, run its test with `node --test packs/<name>/pack.test.js`.
[Adding a style](adding-a-style.md#9-examples-and-golden-images) shows how.

A check is not a replacement for your eyes.
Look at the image.
A picture can pass every check and still look wrong, and the checks do not know what the reference looks like.

## 5. Review

Ask someone else to review the change.
The reviewer looks at the diff and at the new image.
The reviewer asks these questions:

- Does the image match the request?
- Does it match the measured reference, where there is one?
- Do the checks pass for a good reason, and not because a check was relaxed?
- Is the change inside the scope of the request?
- Did the change touch anything that it should not touch?

A change that touches authentication, secrets, permissions or untrusted input gets a security review.
A change to a release or CI workflow does too.

## The rule: the request beats your own check

A check serves the request.
It does not change the request.

Here is an example.
A collage check fails because two gray papers print alike where they touch.
The person asked for those two grays, side by side.
Follow the request.
Keep the grays, and change or drop the check for that case.

Here is a second example.
You add a rule that every title needs a high contrast.
The person asked for a soft, low-contrast title.
Follow the request.
Drop the rule for that title.

If you think the check matters, say so and ask before the check changes the result.
Never change an image against the request to make a check pass.
