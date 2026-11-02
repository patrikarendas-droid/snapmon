# Writer pack · kettle

**Kettle** · category Mug / Cup · group – · family food · design dedicated (looks like: Kettle)
Also recognised as: electric kettle

## Current generated monster names (to replace)
- common: Boilykin
- uncommon: Boilynik
- rare: Boilybeast
- epic: Boilytron
- legendary: Boilyrchon, the Ravenous Kettle

## Move slots (names only; numbers never change)
- `signature` · default "Scalding Splash" · 100% · burn 55% · cd 2 · used by: common, uncommon, rare, epic, legendary
- `legend` (Legendary only) · default "Hunger of the Kettle" · 85% · drain · cd 2
- `ultimate` (Legendary only) · default "Last Flame of the Kettle" · VARIES BY VARIANT → name must be effect-neutral: normal 210% · burn 60% · cd 4 / spectral 210% · defdown 60% · cd 4 / mutated 210% · poison 60% · cd 4
- `kit.steam_puff` · default "Steam Puff" · 60% · defdown 70% · cd 2 · used by: epic
- `kit.refill` · default "Refill" · self heal · cd 3 · used by: no rarity of this object
- `kit.caffeine_kick` · default "Caffeine Kick" · self atkup · cd 3 · used by: rare
- `kit.hot_spill` · default "Hot Spill" · 100% · burn 40% · cd 2 · used by: uncommon, epic, legendary

## Approved examples (Pilot 01, exact)
**apple**
- common: Steals the crunch from every other apple in the bowl. You can hear it chewing at night.
- uncommon: Can make apple cores grow back into whole apples. Keeps doing it in the bin just to annoy whoever takes out the rubbish.
- rare: Fires apple seeds hard enough to punch holes through walls. It's been banned from every school lunchbox in town.
- epic: Can make giant apple trees burst out of the ground, launching entire houses into the sky. The residents are demanding seat belts.
- legendary: Turned the Moon into a giant apple on a dare. The worm living inside is bigger than Australia.
**book**
- common: Slams shut just as you reach the best part. Demands a bookmark as ransom.
- uncommon: Gave its main characters hiccups. The villain's big speech took three hours.
- rare: Anything written in its margins becomes real for an hour. Someone wrote FREE PIZZA, and the school is still finding boxes.
- epic: Made every storybook villain swap books. The big bad wolf is now trying to eat a spaceship.
- legendary: Can write entire new worlds into existence with one page. Keeps forgetting to include toilets.

## Deliver (JSON, status stays "draft")
```json
{
  "kettle": {
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
