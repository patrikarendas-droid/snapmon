# Curated monster writing (live)

The editable source of all curated monster writing: names, flavour text (per rarity) and move display names (per
stable move slot), keyed by object id. Since v0.5.0 every one of the 2,308 objects is here and live (`"status":
"reviewed"`): `pilot-01-approved.json`, `pilot-02-approved.json` and the campaign batches `w01-…json` … `w22-…json`.

The game reads the generated `src/curated-data.js` (`node tools/curated.js build --enable --out src/curated-data.js`),
never these files directly. To correct one field, follow "Correcting live writing" in
[`docs/CONTENT_WRITING_GUIDE.md`](../../docs/CONTENT_WRITING_GUIDE.md). Live files are hash-guarded:
`node tools/campaign.js immutable`; deliberate approved edits are recorded with `node tools/campaign.js rebaseline`.
