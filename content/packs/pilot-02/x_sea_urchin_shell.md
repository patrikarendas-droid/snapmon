# Writer pack · x_sea_urchin_shell

**Sea urchin shell** · category Fish / Sea life · group – · family elemental · design family (looks like: Sea urchin shell)
Also recognised as: –

## Current generated monster names (to replace)
- common: Shelling
- uncommon: Shellimp
- rare: Shellfiend
- epic: Shelltron
- legendary: Shellarchon, the Storm-Born Sea Urchin Shell

## Move slots (names only; numbers never change)
- `signature` · default "Tidal Slap" · 100% · defdown 45% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Blight of the Sea Urchin Shell" · 90% · poison 50% · cd 2
- `ultimate` (Legendary only) · default "Sea Urchin Shell Inferno" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · stun 60% · cd 4
- `kit.fin_slap` · default "Fin Slap" · 120% · cd 2 · used by: uncommon, epic, legendary
- `kit.bubble_ring` · default "Bubble Ring" · 60% · defdown 70% · cd 2 · used by: epic
- `kit.slippery_scales` · default "Slippery Scales" · self defup · cd 3 · used by: rare
- `kit.barb_sting` · default "Barb Sting" · 90% · poison 50% · cd 2 · used by: no rarity of this object

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
  "x_sea_urchin_shell": {
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
