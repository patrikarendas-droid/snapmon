# Writer pack · banana

**Banana** · category Banana · group – · family food · design dedicated (looks like: Banana)
Also recognised as: bananas, plantain

## Current generated monster names (to replace)
- common: Nanatte
- uncommon: Nanagrub
- rare: Nanagloom
- epic: Nanadrake
- legendary: Nanamega, the Golden Banana

## Move slots (names only; numbers never change)
- `signature` · default "Slippery Peel" · 70% · stun 45% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Gaze of the Banana" · 80% · stun 30% · cd 2
- `ultimate` (Legendary only) · default "Molten Banana" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · poison 60% · cd 4
- `kit.peel_slap` · default "Peel Slap" · 120% · cd 2 · used by: epic
- `kit.ripen` · default "Ripen" · self atkup · cd 3 · used by: no rarity of this object
- `kit.mushy_squish` · default "Mushy Squish" · 60% · defdown 70% · cd 2 · used by: uncommon, legendary
- `kit.bunch_up` · default "Bunch Up" · self defup · cd 3 · used by: rare, epic

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
  "banana": {
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
