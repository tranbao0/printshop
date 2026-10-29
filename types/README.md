# Type declarations

The `.d.ts` files in this folder are generated.
Do not edit them by hand.

`tsc` makes them from the JSDoc types of `src/` and `packs/`.
They let a project that type-checks its own code with `strict` and `checkJs` use the package without errors.
`package.json` points to them with the `types` field and the `types` conditions of `exports`.

To make them again, run this command in the root of the repository and commit the result:

```sh
npm run types
```

To check that the committed files are up to date, run:

```sh
npm run types:check
```

CI runs the check and fails if the files differ.
The files use the types of Node.js (for example `Buffer`), so a project that uses them needs `@types/node`.
