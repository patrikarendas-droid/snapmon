# Writer pack · sofa

**Sofa** · category Sofa / Couch · group – · family household · design dedicated (looks like: Sofa)
Also recognised as: couch, studio couch, settee, loveseat, futon, day bed

## Current generated monster names (to replace)
- common: Couchling
- uncommon: Couchbug
- rare: Couchex
- epic: Couchzilla
- legendary: Couchcolossus, the Unmoving Sofa

## Move slots (names only; numbers never change)
- `signature` · default "Cushion Swallow" · 95% · drain · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Fall of the Sofa" · 120% · cd 2
- `ultimate` (Legendary only) · default "Sofa Cataclysm" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · defdown 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · stun 60% · cd 4
- `kit.cushion_crush` · default "Cushion Crush" · 120% · cd 2 · used by: no rarity of this object
- `kit.recline` · default "Recline" · self heal · cd 3 · used by: no rarity of this object
- `kit.spring_snap` · default "Spring Snap" · 80% · stun 30% · cd 2 · used by: epic
- `kit.crumb_cloud` · default "Crumb Cloud" · 60% · defdown 70% · cd 2 · used by: uncommon, rare, epic, legendary

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
  "sofa": {
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
