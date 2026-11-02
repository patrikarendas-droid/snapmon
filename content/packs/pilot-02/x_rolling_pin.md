# Writer pack · x_rolling_pin

**Rolling pin** · category Tool · group kitchen · family household · design composed (looks like: Rolling pin)
Also recognised as: –

## Current generated monster names (to replace)
- common: Pinbit
- uncommon: Pinster
- rare: Pinwraith
- epic: Pindrake
- legendary: Pinultimus, the Old Rolling Pin

## Move slots (names only; numbers never change)
- `signature` · default "Flatten" · 45% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Shadow of the Rolling Pin" · 90% · defdown 45% · cd 2
- `ultimate` (Legendary only) · default "Molten Rolling Pin" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · burn 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.stir_up` · default "Stir Up" · 45% ×3 · cd 3 · used by: rare, epic
- `kit.taste_test` · default "Taste Test" · self heal · cd 3 · used by: uncommon, epic
- `kit.clatter` · default "Clatter" · 80% · stun 30% · cd 2 · used by: no rarity of this object
- `kit.hot_ladle` · default "Hot Ladle" · 100% · burn 40% · cd 2 · used by: legendary

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
  "x_rolling_pin": {
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
