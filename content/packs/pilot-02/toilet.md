# Writer pack · toilet

**Toilet** · category Toilet · group – · family household · design dedicated (looks like: Toilet)
Also recognised as: toilet seat, loo, commode, urinal

## Current generated monster names (to replace)
- common: Flushling
- uncommon: Flushmon
- rare: Flushgoyle
- epic: Flushgeist
- legendary: Flushsovereign, the Unmoving Toilet

## Move slots (names only; numbers never change)
- `signature` · default "Flush Vortex" · 125% · stun 25% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Bulwark of the Toilet" · self defup · cd 3
- `ultimate` (Legendary only) · default "Venom of the Toilet" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · poison 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.plunger_pull` · default "Plunger Pull" · 85% · drain · cd 2 · used by: uncommon, rare, epic, legendary
- `kit.bubble_up` · default "Bubble Up" · 60% · defdown 70% · cd 2 · used by: no rarity of this object
- `kit.porcelain_shell` · default "Porcelain Shell" · self defup · cd 3 · used by: no rarity of this object
- `kit.splash_back` · default "Splash Back" · 80% · stun 30% · cd 2 · used by: epic

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**sock**
- common: Gets a hole in its heel the moment you put it on. Calls this ventilation.
- uncommon: Makes sock puppets out of its loose threads. The puppets keep arguing about who gets the hand.
- rare: Made every shoe in a shopping centre dance. Security guards are chasing tap-dancing trainers.
- epic: Its smell made an entire city evacuate. The sock insists it was the cheese.
- legendary: Knitted a sock big enough to fit the Earth. The planet now slides around the solar system in its slippers.

## Deliver (JSON, status stays "draft")
```json
{
  "toilet": {
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
