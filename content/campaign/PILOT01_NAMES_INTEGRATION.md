# Pilot 01 names added to the approved file (v0.5.0)

Developer-approved on 2026-11-03 (release brief "Activate full writing"). The 50 proposed names in
`content/campaign/pilot-01-names-proposal.json` (5 per object, 10 objects) were inserted into
`content/curated/pilot-01-approved.json` as a `"names"` block at the top of each entry. Nothing else changed.

Proof:
- `git diff` of the file is **70 lines added, 0 removed**: 10 entries × (opening line, 5 names, closing line).
- A script parsed the old and new files and asserted, per entry, that removing `names` gives an object identical to
  the old entry. Every lore line, move name, status and note is identical, and the top-level keys are unchanged.
- SHA-256 before `ced698205fb806ef2930cdfa1c4eb844ac2f95d591bf47635a4b77db226baca7` (the v0.4.6–v0.4.9 approved file),
  after `a8186977dd2e33b52de51942116f824f40c58962a289370d2a07b4f4007010e1`.
- `pilot-02-approved.json` is byte-identical (SHA-256 `592b6ddfb9c7…`, unchanged since v0.4.8).

The immutable guard was then re-recorded deliberately with `node tools/campaign.js rebaseline` (see `baselineLog`
in `content/campaign/manifest.json`). That step also put the 22 released campaign batch files under the same guard.
