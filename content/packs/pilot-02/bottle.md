# Writer pack · bottle

**Bottle** · category Bottle · group – · family elemental · design dedicated (looks like: Bottle)
Also recognised as: water bottle, pop bottle, plastic bottle, soda bottle

## Current generated monster names (to replace)
- common: Fizzkin
- uncommon: Fizzgrub
- rare: Fizzhex
- epic: Fizznaught
- legendary: Fizzrex, the Ever-Burning Bottle

## Move slots (names only; numbers never change)
- `signature` · default "Pressure Burst" · 115% · defdown 50% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Wrath of the Bottle" · self atkup · cd 3
- `ultimate` (Legendary only) · default "Creeping Bottle Blight" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · poison 60% · cd 4 / spectral 210% · defdown 60% · cd 4 / mutated 210% · poison 60% · cd 4
- `kit.fizz_spray` · default "Fizz Spray" · 60% · defdown 70% · cd 2 · used by: uncommon, epic
- `kit.cap_shot` · default "Cap Shot" · 120% · cd 2 · used by: no rarity of this object
- `kit.bubble_shield` · default "Bubble Shield" · self defup · cd 3 · used by: epic, legendary
- `kit.undertow` · default "Undertow" · 85% · drain · cd 2 · used by: rare

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**microwave**
- common: Heats the bowl until nobody can touch it. Leaves the soup freezing cold on purpose.
- uncommon: Can warm leftovers without being plugged in. Still makes you press START six times.
- rare: Traded the temperatures of the ice cream and the kettle. Dessert is boiling and the tea is a block of ice.
- epic: Spins whole houses on an invisible turntable. Neighbours keep coming home to the wrong front door.
- legendary: Can reheat the Sun when it cools down. Still beeps six times because nobody comes to open the door.

## Deliver (JSON, status stays "draft")
```json
{
  "bottle": {
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
