# Writer pack · bicycle

**Bicycle** · category Car / Vehicle · group – · family mechanical · design dedicated (looks like: Bicycle)
Also recognised as: mountain bike, bicycle-built-for-two, bike, road bike, tricycle, unicycle

## Current generated monster names (to replace)
- common: Pedalet
- uncommon: Pedalimp
- rare: Pedalhex
- epic: Pedaldrake
- legendary: Pedalrex, the Ever-Turning Bicycle

## Move slots (names only; numbers never change)
- `signature` · default "Road Rage" · 150% · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Shadow of the Bicycle" · 90% · defdown 45% · cd 2
- `ultimate` (Legendary only) · default "Bicycle Plague" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · poison 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · stun 60% · cd 4
- `kit.horn_blast` · default "Horn Blast" · 80% · stun 30% · cd 2 · used by: epic
- `kit.exhaust_fumes` · default "Exhaust Fumes" · 90% · poison 50% · cd 2 · used by: no rarity of this object
- `kit.turbo_boost` · default "Turbo Boost" · self atkup · cd 3 · used by: legendary
- `kit.hit_and_run` · default "Hit and Run" · 45% ×3 · cd 3 · used by: uncommon, rare, epic

## Approved examples (Pilot 01, exact)
**forklift**
- common: Reverses even when parked, just so it can make the beeping noise.
- uncommon: Uses its forks to pick olives off a pizza without touching the cheese. Calls this precision engineering.
- rare: Picked up an entire house to look for a lost TV remote underneath. It was in the sofa.
- epic: Drove a cruise ship straight across the desert on its forks. The passengers are still asking when they can use the pool.
- legendary: Can stack entire continents like pallets. Ships keep arriving at the wrong ocean.
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.

## Deliver (JSON, status stays "draft")
```json
{
  "bicycle": {
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
