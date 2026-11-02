# Writer pack · washing_machine

**Washing machine** · category Fridge / Appliance · group – · family elemental · design composed (looks like: Washing machine)
Also recognised as: washer, laundry machine, dryer, tumble dryer

## Current generated monster names (to replace)
- common: Spinnykin
- uncommon: Spinnynik
- rare: Spinnygloom
- epic: Spinnygeist
- legendary: Spinnymega, the Ever-Burning Washing Machine

## Move slots (names only; numbers never change)
- `signature` · default "Spin Cycle" · 45% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Hunger of the Washing Machine" · 85% · drain · cd 2
- `ultimate` (Legendary only) · default "Washing Machine Plague" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · poison 60% · cd 4 / spectral 210% · burn 60% · cd 4 / mutated 210% · burn 60% · cd 4
- `kit.frost_breath` · default "Frost Breath" · 90% · defdown 45% · cd 2 · used by: uncommon, legendary
- `kit.power_hum` · default "Power Hum" · 80% · stun 30% · cd 2 · used by: rare, epic
- `kit.cold_storage` · default "Cold Storage" · self defup · cd 3 · used by: epic
- `kit.ice_cube_barrage` · default "Ice Cube Barrage" · 45% ×3 · cd 3 · used by: no rarity of this object

## Approved examples (Pilot 01, exact)
**microwave**
- common: Heats the bowl until nobody can touch it. Leaves the soup freezing cold on purpose.
- uncommon: Can warm leftovers without being plugged in. Still makes you press START six times.
- rare: Traded the temperatures of the ice cream and the kettle. Dessert is boiling and the tea is a block of ice.
- epic: Spins whole houses on an invisible turntable. Neighbours keep coming home to the wrong front door.
- legendary: Can reheat the Sun when it cools down. Still beeps six times because nobody comes to open the door.
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.

## Deliver (JSON, status stays "draft")
```json
{
  "washing_machine": {
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
