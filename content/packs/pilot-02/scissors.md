# Writer pack · scissors

**Scissors** · category Tool · group office · family household · design composed (looks like: Scissors)
Also recognised as: shears

## Current generated monster names (to replace)
- common: Snippy
- uncommon: Snippygrub
- rare: Snippyfiend
- epic: Snippyzilla
- legendary: Snippyrex, the Patient Scissors

## Move slots (names only; numbers never change)
- `signature` · default "Snip Snip" · 50% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Fire of the Scissors" · 100% · burn 40% · cd 2
- `ultimate` (Legendary only) · default "Scissors Plague" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · poison 60% · cd 4 / spectral 210% · burn 60% · cd 4 / mutated 210% · stun 60% · cd 4
- `kit.paper_cut` · default "Paper Cut" · 45% ×3 · cd 3 · used by: uncommon
- `kit.ink_splatter` · default "Ink Splatter" · 90% · poison 50% · cd 2 · used by: rare, epic
- `kit.deadline_panic` · default "Deadline Panic" · 80% · stun 30% · cd 2 · used by: legendary
- `kit.coffee_break` · default "Coffee Break" · self heal · cd 3 · used by: epic

## Approved examples (Pilot 01, exact)
**x_light_switch**
- common: Waits until your hands are full of shopping bags before turning the hall light off. Its timing is excellent.
- uncommon: Can turn on every lamp in the house by sneezing. Has terrible hay fever.
- rare: Discovered how to switch gravity off in one room. The ceiling is now covered in shoes.
- epic: Can switch summer and winter with a click. The ice cream van keeps showing up in snowstorms.
- legendary: Found the switch for time itself. Paused Tuesday for six months because it had not finished its sandwich.
**x_security_camera**
- common: Has recorded 400 hours of a pigeon sitting on a bin. The investigation is ongoing.
- uncommon: Can zoom in far enough to read a sandwich label across town. Now it knows who stole lunch.
- rare: Can replay the last five minutes of real life, not just video. Mostly uses it to watch people trip twice.
- epic: Its new live channel shows everybody in the country at once. It has been banned from surprise parties.
- legendary: Once froze the whole universe for one photograph. Kept it still for three days because somebody blinked.

## Deliver (JSON, status stays "draft")
```json
{
  "scissors": {
    "status": "draft",
    "names": {
      "common": "…",
      "uncommon": "…",
      "rare": "…",
      "epic": "…",
      "legendary": "…"
    },
    "lore": {
      "common": "…",
      "uncommon": "…",
      "rare": "…",
      "epic": "…",
      "legendary": "…"
    },
    "moves": {
      "signature": "…"
    },
    "notes": "optional rationale for reviewers"
  }
}
```
