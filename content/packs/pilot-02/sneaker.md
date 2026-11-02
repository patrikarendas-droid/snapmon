# Writer pack · sneaker

**Sneaker** · category Shoe · group – · family organic · design dedicated (looks like: Sneaker)
Also recognised as: running shoe, shoe, trainer, loafer, clog, sandal

## Current generated monster names (to replace)
- common: Sneaky
- uncommon: Sneakmon
- rare: Sneakbeast
- epic: Sneakdrake
- legendary: Sneakrex, the Thousand-Eyed Sneaker

## Move slots (names only; numbers never change)
- `signature` · default "Sneaky Stomp" · 135% · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Thousand Sneaker Strikes" · 45% ×3 · cd 3
- `ultimate` (Legendary only) · default "Molten Sneaker" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · burn 60% · cd 4 / mutated 210% · stun 60% · cd 4
- `kit.heel_stomp` · default "Heel Stomp" · 120% · cd 2 · used by: uncommon, rare, epic
- `kit.lace_lash` · default "Lace Lash" · 80% · stun 30% · cd 2 · used by: epic, legendary
- `kit.stinky_insole` · default "Stinky Insole" · 90% · poison 50% · cd 2 · used by: no rarity of this object
- `kit.kick_flurry` · default "Kick Flurry" · 45% ×3 · cd 3 · used by: no rarity of this object

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**x_security_camera**
- common: Has recorded 400 hours of a pigeon sitting on a bin. The investigation is ongoing.
- uncommon: Can zoom in far enough to read a sandwich label across town. Now it knows who stole lunch.
- rare: Can replay the last five minutes of real life, not just video. Mostly uses it to watch people trip twice.
- epic: Its new live channel shows everybody in the country at once. It has been banned from surprise parties.
- legendary: Once froze the whole universe for one photograph. Kept it still for three days because somebody blinked.

## Deliver (JSON, status stays "draft")
```json
{
  "sneaker": {
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
