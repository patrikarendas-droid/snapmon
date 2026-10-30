# Curated monster writing

Put reviewed content files here as `*.json` (for example `pilot-01.json`). Shape, rules and workflow:
[`docs/CONTENT_WRITING_GUIDE.md`](../../docs/CONTENT_WRITING_GUIDE.md). An example: [`docs/curated-example.json`](../../docs/curated-example.json).

Files here do **not** change the game by themselves: curated text is switched off (`CURATED.enabled = false` in
`src/curated.js`) and the game does not load it until the activation step is approved.
