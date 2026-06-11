# TODO & Ideas to Explore

A running list of things to investigate or build. Nothing here is committed scope — just parked
ideas with enough context to pick them up later.

## Counterintuitive demo: polished aluminium gets *hotter* than matte black in the sun

**Status:** verified true for the regime this simulator models (radiative balance, no convection).
Parked as a candidate README "fun fact" and/or a guided in-app scenario.

**The hook:** a mirror-bright aluminium plate reflects most of the sunlight, yet it can settle at a
*higher* equilibrium temperature than a matte-black plate that soaks up almost everything.

**Why:** equilibrium temperature follows the *ratio* of solar absorptance to thermal (IR) emittance,
not absorptance alone:

```
α_solar · S = ε_IR · σ · T⁴ · (faces)   ⇒   T_eq⁴ ∝ α_solar / ε_IR
```

Polished metal has low solar absorptance (~0.1) but even lower IR emittance (~0.04), so α/ε ≈ 2–15.
Matte black has α ≈ ε ≈ 0.95, so α/ε ≈ 1. The shiny metal absorbs little but is an even *worse*
emitter, so it traps what it takes in; matte black radiates heat away almost as fast as it absorbs it.

**Verified with the app's own equilibrium solver** (default Solar AM1.5-like spectrum, both faces,
no conduction):

| Preset | T_eq | Solar power absorbed |
|---|---|---|
| Polished aluminium | 398.8 K (125.6 °C) | 0.88 W |
| Matte black paint  | 358.2 K (85.0 °C)  | 9.65 W |
| Anodized aluminium | 360.8 K (87.7 °C)  | 8.27 W |
| White paint        | 312.7 K (39.6 °C)  | 2.08 W |

Polished aluminium absorbs **~11× less** sunlight than matte black, yet ends up **~40 °C hotter**.
(White paint is the *coolest* — low solar α, high IR ε — which is exactly the radiative-cooling /
"cool roof" recipe.)

**Important caveat — the regime matters:** this holds in *radiative balance* (vacuum/space, and this
convection-free simulator). In open terrestrial air, **convection** caps the shiny plate — it absorbs
so little that moving air easily carries the heat away — while matte black must shed ~0.9 kW/m². So on
a breezy day the result flips back to the intuitive "black is hotter." A back-of-envelope balance with
a modest convection coefficient (h ≈ 10 W/m²·K) already reverses it. Cross-checked against
thermo-optical property tables and spacecraft thermal-control references (where α/ε is *the* governing
quantity, because there is no air).

**Ways we could surface it:**
- A short "fun fact" callout in the README intro (drafted, parked per request).
- A one-click **guided scenario** / A–B preset compare that runs both materials to equilibrium and
  shows the resulting α/ε and T_eq side by side.
- Add an optional **convection term** so users can watch the terrestrial flip happen as `h` rises
  (`DESIGN.md` deliberately excludes convection in v1).
- Surface a spectrally-weighted **α_solar / ε_IR readout**, since that ratio is what predicts T_eq.
