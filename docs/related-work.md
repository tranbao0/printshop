# Related work

Other people have built tools in the same field.
This page lists the ones that printshop's author knows, with one line on how printshop differs.
The lines describe each project as its own page describes it.
Check the project for its current state.

## Halftone filters

- [G'MIC](https://gmic.eu/reference/halftone.html) has a `halftone` command and a halftone filter in its plug-in for image editors.
  They turn an image into dots of a chosen size and shape.
  printshop treats the dot screen as one step in a chain, and it builds the whole print look: toner, streaks, specks and torn edges, with seeded streams and checks.
- [libhalftoner](https://libhalftoner.sourceforge.net/) is a collection and library of halftoning algorithms.
  It gives you the algorithms.
  printshop gives you finished images, from a layout, with a fixed seed.
- [halftone](https://www.npmjs.com/package/halftone) is an npm package that converts a square image to a halftone of circles at 45 degrees.
  printshop takes any size, jitters the edges of the dots, and runs the screen inside a larger chain of steps.

## Photocopy looks

- Paid Photoshop actions, such as [Xerox Machine Pro](https://doronsupply.com/product/xerox-machine-pro) and [CopyCat](https://miksks.gumroad.com/l/copycat-photoshop-action), give a photocopy look to an image.
  You run them by hand, in Photoshop.
  printshop is code: it runs from a command, gives the same bytes for the same seed, and runs in CI.

## Ransom-note type

- [blackmailJS](https://github.com/wellcompiled/blackmailJS) is a JavaScript class that styles a string with HTML text elements to look like cut-out letters.
  printshop cuts each letter as its own piece of paper, prints it through the photocopy look, and can animate the letters in an SVG that has no script.

## Risograph

- [p5.riso](https://github.com/antiboredom/p5.riso) is a p5.js library by Sam Lavigne and Tega Brain.
  It prepares one layer for each ink of a risograph printer.
  printshop makes a finished image for the screen, and it has no riso pack yet.
  A riso pack is the kind of style that [adding a style](adding-a-style.md) is for.
- [INKDRUM](https://www.inkdrum.app/) is a risograph print simulator that runs in the browser.
  You change it by hand and see the result at once.
  printshop is a batch tool: the same input and seed give the same file.
- [Digital meets Physical: Risograph Printing with WebGL](https://tympanus.net/codrops/2024/06/27/digital-meets-physical-risograph-printing-with-webgl/) is a Codrops article about a Three.js tool for riso posters.
  It renders in real time on the GPU.
  printshop renders to files, offline, and checks the files.

## Paper collage

- The [torn paper example](https://texample.net/torn-paper) for TikZ, by Jose Luis Diaz, draws torn edges with a fractal line and resets the random seed for each border, so that matching edges come out the same.
  The collage pack has the same idea in a general form: each edge of each piece has its own named stream, so a new piece never changes the edge of another.
  It adds shadows, holding pieces for motifs, tape, and checks over the finished picture.
- [Joshua Davis](https://www.joshuadavis.com/) makes compositions with code that places his own drawn pieces at random, as [this profile](https://www.creativebloq.com/computer-arts/profile-joshua-davis-5079534) describes.
  The collage pack lays out pieces that you place, by hand or in code, and it checks the result: hidden marks, thin slivers, gaps and papers that print alike.

## Animated SVG for READMEs

- [readme-typing-svg](https://github.com/DenverCoder1/readme-typing-svg) is a service that serves an animated SVG of typing text, for a profile page.
  printshop makes the animated file at build time.
  You keep it in your own repository, so it needs no server and no external reference.
  It has no script either, so GitHub shows it in a README.
