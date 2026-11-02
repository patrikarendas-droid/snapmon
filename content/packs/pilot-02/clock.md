# Writer pack · clock

**Alarm clock** · category Clock / Watch · group – · family spectral · design dedicated (looks like: Alarm clock)
Also recognised as: analog clock, clock, digital clock

## Current generated monster names (to replace)
- common: Tockling
- uncommon: Tockimp
- rare: Tockgloom
- epic: Tocknaught
- legendary: Tockultimus, the Hollow Alarm Clock

## Move slots (names only; numbers never change)
- `signature` · default "Time Skip" · 90% · stun 35% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Wrath of the Alarm Clock" · self atkup · cd 3
- `ultimate` (Legendary only) · default "Creeping Alarm Clock Blight" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · poison 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · burn 60% · cd 4
- `kit.alarm_ring` · default "Alarm Ring" · 80% · stun 30% · cd 2 · used by: no rarity of this object
- `kit.tick_tock` · default "Tick Tock" · 45% ×3 · cd 3 · used by: no rarity of this object
- `kit.rewind` · default "Rewind" · self heal · cd 3 · used by: rare, epic
- `kit.deadline` · default "Deadline" · 60% · defdown 70% · cd 2 · used by: uncommon, epic, legendary

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
  "clock": {
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
