# Writer pack · traffic_cone

**Traffic cone** · category Tool · group street · family mechanical · design dedicated (looks like: Traffic cone)
Also recognised as: cone, pylon

## Current generated monster names (to replace)
- common: Coneylet
- uncommon: Coneynik
- rare: Coneyfiend
- epic: Coneynaught
- legendary: Coneyrex, the Ever-Turning Traffic Cone

## Move slots (names only; numbers never change)
- `signature` · default "Detour" · 45% ×3 · cd 3 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Bulwark of the Traffic Cone" · self defup · cd 3
- `ultimate` (Legendary only) · default "Thousand-Year Traffic Cone" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · stun 60% · cd 4 / spectral 210% · poison 60% · cd 4 / mutated 210% · poison 60% · cd 4
- `kit.rush_hour` · default "Rush Hour" · 45% ×3 · cd 3 · used by: rare, epic
- `kit.pothole` · default "Pothole" · 60% · defdown 70% · cd 2 · used by: no rarity of this object
- `kit.road_works` · default "Road Works" · self defup · cd 3 · used by: uncommon
- `kit.gridlock` · default "Gridlock" · 80% · stun 30% · cd 2 · used by: epic, legendary

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
  "traffic_cone": {
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
