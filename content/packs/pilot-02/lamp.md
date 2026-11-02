# Writer pack · lamp

**Table lamp** · category Lamp / Light · group – · family elemental · design dedicated (looks like: Table lamp)
Also recognised as: lamp, lampshade, desk lamp, floor lamp, reading lamp

## Current generated monster names (to replace)
- common: Lumenette
- uncommon: Lumenimp
- rare: Lumengoyle
- epic: Lumenosaur
- legendary: Lumenomega, the Storm-Born Table Lamp

## Move slots (names only; numbers never change)
- `signature` · default "Blinding Glare" · 80% · stun 35% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Wrath of the Table Lamp" · self atkup · cd 3
- `ultimate` (Legendary only) · default "Last Flame of the Table Lamp" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · poison 60% · cd 4
- `kit.flicker` · default "Flicker" · 80% · stun 30% · cd 2 · used by: rare, epic
- `kit.hot_bulb` · default "Hot Bulb" · 100% · burn 40% · cd 2 · used by: legendary
- `kit.glow_up` · default "Glow Up" · self atkup · cd 3 · used by: uncommon, epic
- `kit.moth_swarm` · default "Moth Swarm" · 45% ×3 · cd 3 · used by: no rarity of this object

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**x_security_camera**
- common: Has recorded 400 hours of a pigeon sitting on a bin. The investigation is ongoing.
- uncommon: Can zoom in far enough to read a sandwich label across town. Now it knows who stole lunch.
- rare: Can replay the last five minutes of real life, not just video. Mostly uses it to watch people trip twice.
- epic: Its new live channel shows everybody in the country at once. It has been banned from surprise parties.
- legendary: Once froze the whole universe for one photograph. Kept it still for three days because somebody blinked.

## Deliver (JSON, status stays "draft")
```json
{
  "lamp": {
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
