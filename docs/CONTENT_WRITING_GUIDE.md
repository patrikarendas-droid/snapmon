# Content writing guide: curated monster writing

Hand-written, reviewed flavour text and move names for specific objects. **Status: Phase 1 foundation. Curated text is
switched off and the game does not load it.** Adding files changes nothing in the game until the activation step is
approved (see "Activation" at the end).

## Where content lives

- One or more files in `content/curated/`, e.g. `content/curated/pilot-01.json`. Any `*.json` there is checked.
- A complete example (a dummy, never loaded): [`docs/curated-example.json`](curated-example.json).
- Code: `src/curated.js` (schema, validator, lookup) · tool: `tools/curated.js` · tests: `tests/curated.js`.

## The JSON shape

```json
{
  "schema": 1,
  "batch": "pilot-01",
  "entries": {
    "x_energy_drink": {
      "status": "draft",
      "notes": "free text for reviewers (never shown in the game)",
      "lore": {
        "common":    ["First variant.", "Second variant."],
        "uncommon":  "A single text is fine too.",
        "rare":      "…",
        "epic":      "…",
        "legendary": "…"
      },
      "moves": {
        "signature":      "Caffeine Spike",
        "kit.fizz_burst": "Shake and Pop",
        "legend":         "The Long Shift",
        "ultimate":       "No More Sleep"
      }
    }
  }
}
```

| Field | Required | Rules |
|---|---|---|
| `schema` | yes | always `1` |
| `batch` | no | a label for the batch |
| `entries` | yes | an object; each key is an **exact object id** (see below) |
| `status` | no | `"draft"` (default) or `"reviewed"`. **Only `reviewed` entries can ever reach the game.** |
| `notes` | no | reviewer notes, up to 600 characters |
| `lore` | no | keys: `common`, `uncommon`, `rare`, `epic`, `legendary` (any subset). Each is a text or a list of up to 8 texts. |
| `moves` | no | move key → new display name (see "Move names") |

Everything is optional. A missing rarity, a missing entry or a broken field simply keeps today's generated text.

## Finding the exact object id

Entries are keyed by the registry id from `src/objects.js`, **not** by what the camera says or the display name.
Ids are often not plain words: `x_light_switch`, `x_security_camera`, `cutlery_spoon`, `i_hip`.

```
node tools/curated.js lookup "light switch"
  "light switch" is recognised as: x_light_switch  (Light switch)
```

Several labels can point to one object (e.g. "combination lock" → `padlock`); write for the object, not the label.

## Checking and previewing

```
node tools/curated.js validate            # all of content/curated/*.json
node tools/curated.js validate my.json    # one file
node tools/curated.js preview  my.json    # current text vs proposed text per rarity, and move names with their numbers
```

The validator rejects:
- unknown ids (it suggests the right id when you used a name or label);
- duplicate ids, inside a file or across files;
- unknown fields (typos like `lores`), wrong rarities, wrong types;
- blank texts, texts under 12 or over 220 characters, and the same variant twice;
- placeholders, template tokens or markup: `{obj}`, `[name]`, `<b>`, TODO, TBD, lorem ipsum, XXX, or a trailing "...";
- double spaces or line breaks inside a text;
- unknown move keys, move names outside 3–28 characters or with unusual symbols;
- move names that would collide with another of that object's moves (battle cooldowns are tracked per name).

It warns (but allows): a text without final punctuation, or a toolbox mention for an object that is not a toolbox.

## Editing from a phone

1. On GitHub (app or browser), open the repository, go to `content/curated/` and open a file. Tap the pencil
   ("Edit"), or "Add file → Create new file" with a name ending in `.json`.
2. Copy an entry from `docs/curated-example.json`, change the id and the texts. Keep the quotes and commas: each
   text in `"double quotes"`, items separated by commas, no comma after the last item.
3. Commit to a **new branch** (not the production branch) and ask Claude Code to validate and preview it, or run
   `node tools/curated.js validate` yourself. Fix anything it lists.
4. Typography: in texts, straight or curly apostrophes are both fine; write `"` inside a text as `\"`. Move names
   use plain letters, digits, spaces and `' - ! & . ,`.

## Move names

Only the **name** of a move can change. Power, hits, effect, chance, cooldown and which moves a monster gets never
change. Move keys:

| Key | Which move |
|---|---|
| `signature` | the object's signature move (first move, every rarity) |
| `kit.<slug>` | a move from the object's move kit; the slug is the current name in lower case with `_` (`Fizz Burst` → `kit.fizz_burst`). `preview` lists the keys each object has. |
| `legend` | the Legendary's legend move |
| `ultimate` | the Legendary's Ultimate |

**Not yet applied, by design.** Saved monsters store their moves by name and battles track cooldowns by name; abilities
have no stable id today. Proposed for the activation step (needs approval): when a new monster is created, store a
stable key on each ability (`key: "signature" | "kit.fizz_burst" | "legend" | "ultimate"`), additive and invisible to
older saves; apply the curated name only to new monsters that have the key. Existing monsters keep their move names.
Until then move names are validated and previewed only (`CURATED.movesEnabled` stays false).

## Writing rules

Rarity is a **different premise**, not the same sentence with bigger adjectives:

| Rarity | Premise | Energy drink, for example |
|---|---|---|
| Common | a short, witty everyday nuisance tied to the object's real use or shape | sprays the ceiling when opened |
| Uncommon | a specific strange habit or unsettling anomaly, still relatable | its heartbeat speeds up when someone yawns |
| Rare | a memorable local legend or uncanny trick with recognisable consequences | night-shift workers leave it offerings; the vending machine never jams for them |
| Epic | a dangerous, cinematic supernatural threat rooted in what the object does | it feeds on the sleep you were meant to have |
| Legendary | original myth-level lore about what this exact object does | the first sunrise happened because it kept the sky awake |

- **Be specific to the object's function and body.** A security camera watches, records and has blind spots; a light
  switch is about light and dark; an energy drink about caffeine, sleeplessness, fizz. No toolbox, kingdom or gods
  filler unless it truly fits.
- **Avoid the old crutches:** "ancient texts say", "nobody has ever seen", "hunters whisper", "the world trembles",
  "it is still growing". Prefer one surprising, concrete image.
- **Short and rhythmic:** one or two sentences; 60–160 characters reads best on a phone (220 is the hard limit).
- **Tone:** playful to darkly fantastical, family-friendly. No gore, no fast-ageing memes, no brand slogans, no
  trademarked characters, no real people.
- **Names fit the object** but never describe numbers ("doubles damage") the move does not have.
- **Variants:** 2–3 per rarity for objects that appear often; one is fine otherwise. Variants are picked by the
  monster's seed, so the same monster always shows the same one.
- **Self-contained:** the text is shown on the monster sheet and in the encyclopedia; it must not rely on the
  monster's name, colour or level.

## What curated text will and will not change (when activated)

- **New monsters only:** flavour text is chosen when a monster appears and stored on it; existing monsters keep theirs
  (unless the player chooses a refresh, if one is added later).
- **Encyclopedia:** its text is computed when shown, so activated entries also update the encyclopedia text of
  species already met (approved: the improved lore is shown consistently).
- **Never:** names, stats, artwork, odds, move numbers, saves format.

## Activation (Phase 2, needs explicit approval)

1. Review a pilot batch with `preview`; mark approved entries `"status": "reviewed"`.
2. `node tools/curated.js build --out src/curated-data.js` writes the reviewed entries as a script.
3. Load `src/curated.js` and `src/curated-data.js` in `index.html` (after `game.js`), the single-file build
   (`tools/build.js`) and the test loaders; set `CURATED.enabled = true`.
4. Keep a gameplay baseline that does not include text (stats, move numbers and effects, cooldowns, artwork, rarity,
   recognition, balance) and must stay identical; re-record only the text part on purpose and note it in the
   journal; ship as a version bump. Stable ability ids (approved) come first, as their own tested step.
Rollback: set `CURATED.enabled = false` (or revert the activation commit); stored monster texts are unaffected.
