# Writer pack · x_tea_bag

**Tea bag** · category Meal / Snack · group pantry · family food · design composed (looks like: Tea bag)
Also recognised as: –

## Current generated monster names (to replace)
- common: Bagbit
- uncommon: Bagnik
- rare: Bagwraith
- epic: Bagnaught
- legendary: Bagcolossus, the Insatiable Tea Bag

## Move slots (names only; numbers never change)
- `signature` · default "Spill Out" · 100% · burn 50% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Fall of the Tea Bag" · 120% · cd 2
- `ultimate` (Legendary only) · default "Thousand-Year Tea Bag" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · stun 60% · cd 4 / spectral 210% · defdown 60% · cd 4 / mutated 210% · burn 60% · cd 4
- `kit.flour_cloud` · default "Flour Cloud" · 60% · defdown 70% · cd 2 · used by: rare, epic, legendary
- `kit.spice_storm` · default "Spice Storm" · 100% · burn 40% · cd 2 · used by: no rarity of this object
- `kit.grain_avalanche` · default "Grain Avalanche" · 45% ×3 · cd 3 · used by: no rarity of this object
- `kit.long_shelf_life` · default "Long Shelf Life" · self defup · cd 3 · used by: uncommon, epic

## Approved examples (Pilot 01, exact)
**x_energy_drink**
- common: Shakes itself whenever you try to open it. The ceiling has filed a complaint.
- uncommon: Gave a sleepy houseplant a tiny sip. The plant has started doing push-ups.
- rare: Made an entire office type faster than the printers could print. The photocopier has called in sick.
- epic: Made every sloth in the rainforest sprint. Scientists have stopped trying to count them.
- legendary: At its first sip, every star in the sky started dancing the conga. Astronomers are begging for one still photograph.
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.

## Deliver (JSON, status stays "draft")
```json
{
  "x_tea_bag": {
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
