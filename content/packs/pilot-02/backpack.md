# Writer pack · backpack

**Backpack** · category Bag / Box · group – · family organic · design dedicated (looks like: Backpack)
Also recognised as: rucksack, school bag

## Current generated monster names (to replace)
- common: Packylet
- uncommon: Packymp
- rare: Packywraith
- epic: Packynaught
- legendary: Packymega, the Primordial Backpack

## Move slots (names only; numbers never change)
- `signature` · default "Zipper Bite" · 115% · defdown 45% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Fire of the Backpack" · 100% · burn 40% · cd 2
- `ultimate` (Legendary only) · default "Shattering Backpack" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · defdown 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · burn 60% · cd 4
- `kit.strap_snag` · default "Strap Snag" · 80% · stun 30% · cd 2 · used by: no rarity of this object
- `kit.stuff_in` · default "Stuff In" · 85% · drain · cd 2 · used by: uncommon, epic
- `kit.overpack` · default "Overpack" · self defup · cd 3 · used by: rare
- `kit.bag_swing` · default "Bag Swing" · 120% · cd 2 · used by: epic, legendary

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**x_light_switch**
- common: Waits until your hands are full of shopping bags before turning the hall light off. Its timing is excellent.
- uncommon: Can turn on every lamp in the house by sneezing. Has terrible hay fever.
- rare: Discovered how to switch gravity off in one room. The ceiling is now covered in shoes.
- epic: Can switch summer and winter with a click. The ice cream van keeps showing up in snowstorms.
- legendary: Found the switch for time itself. Paused Tuesday for six months because it had not finished its sandwich.

## Deliver (JSON, status stays "draft")
```json
{
  "backpack": {
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
