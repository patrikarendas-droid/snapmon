# Writer pack · umbrella

**Umbrella** · category Umbrella · group – · family household · design dedicated (looks like: Umbrella)
Also recognised as: parasol, parachute

## Current generated monster names (to replace)
- common: Brollytte
- uncommon: Brollymon
- rare: Brollygoyle
- epic: Brollysaur
- legendary: Brollycolossus, the Old Umbrella

## Move slots (names only; numbers never change)
- `signature` · default "Spoke Jab" · 45% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Hunger of the Umbrella" · 85% · drain · cd 2
- `ultimate` (Legendary only) · default "Umbrella Inferno" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · burn 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.canopy_block` · default "Canopy Block" · self defup · cd 3 · used by: legendary
- `kit.downpour` · default "Downpour" · 45% ×3 · cd 3 · used by: epic
- `kit.gust` · default "Gust" · 80% · stun 30% · cd 2 · used by: uncommon, epic
- `kit.pointy_end` · default "Pointy End" · 120% · cd 2 · used by: rare

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**rubber_duck**
- common: Only squeaks when everyone in the room is trying to be quiet. It has ruined three bedtime stories.
- uncommon: Floats in mid-air like an invisible bath is holding it up. Science teachers have stopped inviting it to class.
- rare: Copies anyone's voice perfectly, but adds QUACK at the end. Three radio stations have fired it.
- epic: Turned an entire city into bright yellow rubber. The statues bounce now, and the mayor is furious.
- legendary: Convinced every real duck on Earth that it is their king. The ducks have formed an army and demanded more bread.

## Deliver (JSON, status stays "draft")
```json
{
  "umbrella": {
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
