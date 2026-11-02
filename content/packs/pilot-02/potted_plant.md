# Writer pack · potted_plant

**Potted plant** · category Plant / Flower · group – · family botanical · design dedicated (looks like: Potted plant)
Also recognised as: pot, flowerpot, houseplant, plant, fern

## Current generated monster names (to replace)
- common: Fernling
- uncommon: Fernimp
- rare: Fernwraith
- epic: Fernaught
- legendary: Fernarchon, the Deep-Rooted Potted Plant

## Move slots (names only; numbers never change)
- `signature` · default "Thorn Lash" · 105% · poison 50% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Shadow of the Potted Plant" · 90% · defdown 45% · cd 2
- `ultimate` (Legendary only) · default "Potted Plant Eclipse" · 210% · stun 60% · cd 4
- `kit.pollen_puff` · default "Pollen Puff" · 60% · defdown 70% · cd 2 · used by: uncommon
- `kit.sap_sip` · default "Sap Sip" · 85% · drain · cd 2 · used by: rare, epic
- `kit.vine_snare` · default "Vine Snare" · 80% · stun 30% · cd 2 · used by: legendary
- `kit.fresh_growth` · default "Fresh Growth" · self heal · cd 3 · used by: epic

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
  "potted_plant": {
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
