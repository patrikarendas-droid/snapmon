# Writer pack · x_tuning_fork

**Tuning fork** · category Instrument · group – · family spectral · design family (looks like: Tuning fork)
Also recognised as: –

## Current generated monster names (to replace)
- common: Forkbit
- uncommon: Forkgrub
- rare: Forkfiend
- epic: Forkdrake
- legendary: Forkultimus, the Forgotten Tuning Fork

## Move slots (names only; numbers never change)
- `signature` · default "Haunting Chord" · 85% · stun 35% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Hunger of the Tuning Fork" · 85% · drain · cd 2
- `ultimate` (Legendary only) · default "Stillness of the Tuning Fork" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · stun 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.crescendo` · default "Crescendo" · self atkup · cd 3 · used by: no rarity of this object
- `kit.sour_note` · default "Sour Note" · 60% · defdown 70% · cd 2 · used by: uncommon
- `kit.drum_roll` · default "Drum Roll" · 45% ×3 · cd 3 · used by: epic, legendary
- `kit.feedback` · default "Feedback" · 80% · stun 30% · cd 2 · used by: rare, epic

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**forklift**
- common: Reverses even when parked, just so it can make the beeping noise.
- uncommon: Uses its forks to pick olives off a pizza without touching the cheese. Calls this precision engineering.
- rare: Picked up an entire house to look for a lost TV remote underneath. It was in the sofa.
- epic: Drove a cruise ship straight across the desert on its forks. The passengers are still asking when they can use the pool.
- legendary: Can stack entire continents like pallets. Ships keep arriving at the wrong ocean.

## Deliver (JSON, status stays "draft")
```json
{
  "x_tuning_fork": {
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
