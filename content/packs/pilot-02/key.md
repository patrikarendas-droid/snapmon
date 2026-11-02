# Writer pack · key

**Key** · category Keys / Small item · group – · family mechanical · design dedicated (looks like: Key)
Also recognised as: keys, keychain, car key

## Current generated monster names (to replace)
- common: Jingle
- uncommon: Jinglemp
- rare: Jinglefiend
- epic: Jingledrake
- legendary: Jinglerex, the Unbroken Key

## Move slots (names only; numbers never change)
- `signature` · default "Jingle Jab" · 45% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Hunger of the Key" · 85% · drain · cd 2
- `ultimate` (Legendary only) · default "Stillness of the Key" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · stun 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.jingle_jangle` · default "Jingle Jangle" · 80% · stun 30% · cd 2 · used by: no rarity of this object
- `kit.lock_out` · default "Lock Out" · self defup · cd 3 · used by: epic
- `kit.key_scratch` · default "Key Scratch" · 60% · defdown 70% · cd 2 · used by: rare, epic
- `kit.pick_pocket` · default "Pick Pocket" · 85% · drain · cd 2 · used by: uncommon, legendary

## Approved examples (Pilot 01, exact)
**padlock**
- common: Locks itself every time someone says WHERE IS THE KEY? The key has started hiding in solidarity.
- uncommon: Can lock a sneeze inside your nose. It rattles around until you say excuse me.
- rare: Locked an entire conversation. Everyone stood with their mouths open until somebody found the key.
- epic: Locked a thunderstorm inside a jam jar. Now uses the thunder as its ringtone.
- legendary: Once locked the Sun in a shed for being too bright. Now nobody can find the shed because it is dark.
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.

## Deliver (JSON, status stays "draft")
```json
{
  "key": {
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
