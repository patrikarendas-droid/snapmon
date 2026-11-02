# Writer pack · x_traffic_light

**Traffic light** · category Tool · group street · family mechanical · design composed (looks like: Traffic light)
Also recognised as: –

## Current generated monster names (to replace)
- common: Lightling
- uncommon: Lightgrub
- rare: Lightfiend
- epic: Lightron
- legendary: Lightsovereign, the Unbroken Traffic Light

## Move slots (names only; numbers never change)
- `signature` · default "Red Light" · 45% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Fall of the Traffic Light" · 120% · cd 2
- `ultimate` (Legendary only) · default "Traffic Light Inferno" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · stun 60% · cd 4 / mutated 210% · defdown 60% · cd 4
- `kit.rush_hour` · default "Rush Hour" · 45% ×3 · cd 3 · used by: uncommon, epic
- `kit.pothole` · default "Pothole" · 60% · defdown 70% · cd 2 · used by: legendary
- `kit.road_works` · default "Road Works" · self defup · cd 3 · used by: rare
- `kit.gridlock` · default "Gridlock" · 80% · stun 30% · cd 2 · used by: epic

## Approved examples (Pilot 01, exact)
**x_light_switch**
- common: Waits until your hands are full of shopping bags before turning the hall light off. Its timing is excellent.
- uncommon: Can turn on every lamp in the house by sneezing. Has terrible hay fever.
- rare: Discovered how to switch gravity off in one room. The ceiling is now covered in shoes.
- epic: Can switch summer and winter with a click. The ice cream van keeps showing up in snowstorms.
- legendary: Found the switch for time itself. Paused Tuesday for six months because it had not finished its sandwich.
**x_security_camera**
- common: Has recorded 400 hours of a pigeon sitting on a bin. The investigation is ongoing.
- uncommon: Can zoom in far enough to read a sandwich label across town. Now it knows who stole lunch.
- rare: Can replay the last five minutes of real life, not just video. Mostly uses it to watch people trip twice.
- epic: Its new live channel shows everybody in the country at once. It has been banned from surprise parties.
- legendary: Once froze the whole universe for one photograph. Kept it still for three days because somebody blinked.

## Deliver (JSON, status stays "draft")
```json
{
  "x_traffic_light": {
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
