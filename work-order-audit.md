# Work Order Card Audit
_Icon legend: 🟠 orange = ARM · 🔵 blue/purple = CON · 🟢 green = TRI · 🩷 pink = TRG_

> Note: initial audit had CON and TRI icons swapped. This is the corrected version.

---

## wo01 — Artisan's Shield
![Artisan's Shield](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Artisan's%20Shield.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 1 ARM + 1 **TRI** + 3 TRG | $27 |
| **Data** | 1 ARM + 1 **CON** + 3 TRG | $27 |

❌ **MISMATCH** — green icon is TRI, not CON. Fix: `1 ARM + 1 TRI + 3 TRG`

---

## wo02 — Cliffwatch Lenses
![Cliffwatch Lenses](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Cliffwatch%20Lenses.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 1 **CON** + 2 **TRI** + 1 TRG | $21 |
| **Data** | 1 **ARM** + 2 **CON** + 1 TRG | $21 |

❌ **MISMATCH** — first icon is blue (CON), not ARM; second is green (TRI), not CON. Fix: `1 CON + 2 TRI + 1 TRG`

---

## wo03 — Dragonbane
![Dragonbane](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Dragonbane.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 ARM + 1 CON + 1 TRI | $21 |
| **Data** | 2 ARM + 1 TRI + 1 CON | $21 |

⚠️ **ORDER ONLY** — same ingredient counts, but CON and TRI are listed in opposite order from the card. Gameplay unaffected. Fix: `2 ARM + 1 CON + 1 TRI`

---

## wo04 — Endless Paintbrush
![Endless Paintbrush](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Endless%20Paintbrush.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 **TRI** + 2 TRG | $20 |
| **Data** | 2 **CON** + 2 TRG | $20 |

❌ **MISMATCH** — green icons are TRI, not CON. Fix: `2 TRI + 2 TRG`

---

## wo05 — Hartswood Carrier
![Hartswood Carrier](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Hartswood%20Carrier.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 ARM + 1 TRG | $15 |
| **Data** | 2 ARM + 1 TRG | $15 |

✅ **Match**

---

## wo06 — Heartsong
![Heartsong](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Heartsong.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 ARM + 2 **CON** + 1 **TRI** | $28 |
| **Data** | 2 ARM + 2 **TRI** + 1 **CON** | $28 |

❌ **MISMATCH** — counts are wrong: card has 2×CON + 1×TRI, data has 2×TRI + 1×CON. Fix: `2 ARM + 2 CON + 1 TRI`

---

## wo07 — Hopesplinter
![Hopesplinter](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Hopesplinter.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 3 ARM + 1 **CON** + 1 TRG | $32 |
| **Data** | 3 ARM + 1 **TRI** + 1 TRG | $32 |

❌ **MISMATCH** — blue icon is CON, not TRI. Fix: `3 ARM + 1 CON + 1 TRG`

---

## wo08 — Mystic Compass
![Mystic Compass](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Mystic%20Compass.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 **CON** + 1 **TRI** | $15 |
| **Data** | 2 **TRI** + 1 **CON** | $15 |

❌ **MISMATCH** — counts wrong: 2×CON + 1×TRI on card, 2×TRI + 1×CON in data. Fix: `2 CON + 1 TRI`

---

## wo09 — Seaheart Diviner
![Seaheart Diviner](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Seaheart%20Diviner.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 1 **CON** + 4 **TRI** | $29 |
| **Data** | 1 **TRI** + 4 **CON** | $29 |

❌ **MISMATCH** — counts wrong: 1×CON + 4×TRI on card, 1×TRI + 4×CON in data. Fix: `1 CON + 4 TRI`

---

## wo10 — Seared Drake Feast
![Seared Drake Feast](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Seared%20Drake%20Feast.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 1 **CON** + 2 TRG | $16 |
| **Data** | 1 **ARM** + 2 TRG | $16 |

❌ **MISMATCH** — first icon is blue (CON), not ARM. Fix: `1 CON + 2 TRG`

---

## wo11 — Seeker's Gaze
![Seeker's Gaze](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Seeker's%20Gaze.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 1 **CON** + 2 **TRI** + 1 TRG | $22 |
| **Data** | 1 **TRI** + 2 **CON** + 1 TRG | $22 |

❌ **MISMATCH** — counts wrong: 1×CON + 2×TRI on card, 1×TRI + 2×CON in data. Fix: `1 CON + 2 TRI + 1 TRG`

---

## wo12 — Starforge Steel _(original complaint)_
![Starforge Steel](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Starforge%20Steel.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 **CON** + 1 **TRI** + 2 TRG | $27 |
| **Data** | 2 **TRI** + 1 **CON** + 2 TRG | $27 |

❌ **MISMATCH** — counts wrong: 2×CON + 1×TRI on card, 2×TRI + 1×CON in data. Fix: `2 CON + 1 TRI + 2 TRG`

---

## wo13 — Starpetal Infusion
![Starpetal Infusion](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Starpetal%20Infusion.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 3 **CON** + 1 **TRI** | $19 |
| **Data** | 3 **TRI** + 1 **CON** | $19 |

❌ **MISMATCH** — counts wrong: 3×CON + 1×TRI on card, 3×TRI + 1×CON in data. Fix: `3 CON + 1 TRI`

---

## wo14 — The Last Word
![The Last Word](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/The%20Last%20Word.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 3 ARM + 1 **CON** | $23 |
| **Data** | 3 ARM + 1 **TRI** | $23 |

❌ **MISMATCH** — blue icon is CON, not TRI. Fix: `3 ARM + 1 CON`

---

## wo15 — The Negotiator
![The Negotiator](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/The%20Negotiator.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 ARM + 2 TRG | $21 |
| **Data** | 2 ARM + 2 TRG | $21 |

✅ **Match**

---

## wo16 — Truthringer
![Truthringer](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Truthringer.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 3 **TRI** + 1 TRG | $21 |
| **Data** | 3 **CON** + 1 TRG | $21 |

❌ **MISMATCH** — green icons are TRI, not CON. Fix: `3 TRI + 1 TRG`

---

## wo17 — Velvet Sting
![Velvet Sting](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Velvet%20Sting.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 ARM + 1 TRG | $16 |
| **Data** | 2 ARM + 1 TRG | $16 |

✅ **Match**

---

## wo18 — Vial of Blessings
![Vial of Blessings](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Vial%20of%20Blessings.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 CON + 2 TRI | $22 |
| **Data** | 2 TRI + 2 CON | $22 |

⚠️ **ORDER ONLY** — both counts are 2, same ingredient types. String order differs from card. Gameplay unaffected. Fix: `2 CON + 2 TRI`

---

## wo19 — Winter Stockpile
![Winter Stockpile](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Winter%20Stockpile.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 1 CON + 4 TRG | $28 |
| **Data** | 1 CON + 4 TRG | $28 |

✅ **Match**

---

## wo20 — Wintercourt Mantle
![Wintercourt Mantle](.claude/worktrees/v0.4-card-pickers/public/cards/workorders/Wintercourt%20Mantle.png)

| | Recipe | Price |
|---|---|---|
| **Card art** | 2 ARM + 1 CON + 1 TRI | $24 |
| **Data** | 2 ARM + 1 TRI + 1 CON | $24 |

⚠️ **ORDER ONLY** — same ingredient counts (1 each), string order differs from card. Gameplay unaffected. Fix: `2 ARM + 1 CON + 1 TRI`

---

## Summary

| Card | Status | Fix |
|---|---|---|
| wo01 Artisan's Shield | ❌ Type | `1 ARM + 1 TRI + 3 TRG` |
| wo02 Cliffwatch Lenses | ❌ Type | `1 CON + 2 TRI + 1 TRG` |
| wo03 Dragonbane | ⚠️ Order | `2 ARM + 1 CON + 1 TRI` |
| wo04 Endless Paintbrush | ❌ Type | `2 TRI + 2 TRG` |
| wo05 Hartswood Carrier | ✅ | — |
| wo06 Heartsong | ❌ Count | `2 ARM + 2 CON + 1 TRI` |
| wo07 Hopesplinter | ❌ Type | `3 ARM + 1 CON + 1 TRG` |
| wo08 Mystic Compass | ❌ Count | `2 CON + 1 TRI` |
| wo09 Seaheart Diviner | ❌ Count | `1 CON + 4 TRI` |
| wo10 Seared Drake Feast | ❌ Type | `1 CON + 2 TRG` |
| wo11 Seeker's Gaze | ❌ Count | `1 CON + 2 TRI + 1 TRG` |
| wo12 Starforge Steel | ❌ Count | `2 CON + 1 TRI + 2 TRG` |
| wo13 Starpetal Infusion | ❌ Count | `3 CON + 1 TRI` |
| wo14 The Last Word | ❌ Type | `3 ARM + 1 CON` |
| wo15 The Negotiator | ✅ | — |
| wo16 Truthringer | ❌ Type | `3 TRI + 1 TRG` |
| wo17 Velvet Sting | ✅ | — |
| wo18 Vial of Blessings | ⚠️ Order | `2 CON + 2 TRI` |
| wo19 Winter Stockpile | ✅ | — |
| wo20 Wintercourt Mantle | ⚠️ Order | `2 ARM + 1 CON + 1 TRI` |

**4 correct · 13 type/count errors · 3 display-order only**

> Root cause: TRI and CON icons were entered with swapped labels throughout the data. Blue/purple = CON (Consumable potion). Green = TRI (Trinket gem).
