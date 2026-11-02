# Writer pack · pizza

**Pizza** · category Meal / Snack · group – · family food · design dedicated (looks like: Pizza)
Also recognised as: pizza pie, pizza slice

## Current generated monster names (to replace)
- common: Crustybit
- uncommon: Crustynik
- rare: Crustybeast
- epic: Crustyzilla
- legendary: Crustymega, the Golden Pizza

## Move slots (names only; numbers never change)
- `signature` · default "Grease Fire" · 100% · burn 50% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Rebirth of the Pizza" · self heal · cd 3
- `ultimate` (Legendary only) · default "Shattering Pizza" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · defdown 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · stun 60% · cd 4
- `kit.gravy_splash` · default "Gravy Splash" · 100% · burn 40% · cd 2 · used by: epic
- `kit.second_helping` · default "Second Helping" · self heal · cd 3 · used by: uncommon, rare, legendary
- `kit.crumb_toss` · default "Crumb Toss" · 45% ×3 · cd 3 · used by: epic
- `kit.food_coma` · default "Food Coma" · 80% · stun 30% · cd 2 · used by: no rarity of this object

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
  "pizza": {
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
