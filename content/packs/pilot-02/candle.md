# Writer pack · candle

**Candle** · category Candle / Fire · group – · family elemental · design dedicated (looks like: Candle)
Also recognised as: tea light

## Current generated monster names (to replace)
- common: Wicky
- uncommon: Wickster
- rare: Wickfiend
- epic: Wicktron
- legendary: Wickarchon, the Storm-Born Candle

## Move slots (names only; numbers never change)
- `signature` · default "Wax Inferno" · 100% · burn 65% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Curse of the Candle" · 60% · defdown 70% · cd 2
- `ultimate` (Legendary only) · default "Last Flame of the Candle" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.wax_drip` · default "Wax Drip" · 100% · burn 40% · cd 2 · used by: uncommon, rare
- `kit.smoke_screen` · default "Smoke Screen" · 60% · defdown 70% · cd 2 · used by: epic
- `kit.flare_up` · default "Flare Up" · self atkup · cd 3 · used by: legendary
- `kit.melt` · default "Melt" · 85% · drain · cd 2 · used by: epic

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
  "candle": {
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
