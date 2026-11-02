# Writer pack · pillow

**Pillow** · category Bed / Pillow · group – · family household · design dedicated (looks like: Pillow)
Also recognised as: cushion, throw pillow

## Current generated monster names (to replace)
- common: Fluffette
- uncommon: Fluffgrub
- rare: Fluffgloom
- epic: Fluffdrake
- legendary: Fluffomega, the Old Pillow

## Move slots (names only; numbers never change)
- `signature` · default "Lullaby" · 60% · stun 50% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Blight of the Pillow" · 90% · poison 50% · cd 2
- `ultimate` (Legendary only) · default "Pillow Eclipse" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · stun 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.feather_burst` · default "Feather Burst" · 45% ×3 · cd 3 · used by: epic
- `kit.pillow_fort` · default "Pillow Fort" · self defup · cd 3 · used by: uncommon, epic
- `kit.nap_time` · default "Nap Time" · self heal · cd 3 · used by: legendary
- `kit.smother_hug` · default "Smother Hug" · 85% · drain · cd 2 · used by: rare

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**padlock**
- common: Locks itself every time someone says WHERE IS THE KEY? The key has started hiding in solidarity.
- uncommon: Can lock a sneeze inside your nose. It rattles around until you say excuse me.
- rare: Locked an entire conversation. Everyone stood with their mouths open until somebody found the key.
- epic: Locked a thunderstorm inside a jam jar. Now uses the thunder as its ringtone.
- legendary: Once locked the Sun in a shed for being too bright. Now nobody can find the shed because it is dark.

## Deliver (JSON, status stays "draft")
```json
{
  "pillow": {
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
