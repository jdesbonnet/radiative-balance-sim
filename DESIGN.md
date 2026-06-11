# Electromagnetic Heating Slab Simulator Design

## 1. Purpose

Build a simple browser-based web app that simulates how a horizontal material slab approaches thermal equilibrium when illuminated from above by electromagnetic radiation.

The app should make the energy balance visible in real time:

- Incoming spectral radiation heats the slab according to wavelength-dependent absorptivity.
- The slab emits thermal radiation according to its temperature and wavelength-dependent emissivity.
- Optional air convection can add or remove heat through the active surface(s).
- Temperature, emitted spectrum, and power balance update continuously while the simulation runs.

The first iteration should be simple, plausible, and educational rather than a high-fidelity scientific solver. Preset values should be plausible engineering defaults. More accurate datasets can be plugged in later.

## 2. Product Decisions For Version 1

These decisions supersede the earlier open questions.

- Use a lumped uniform-temperature slab model for version 1.
- Defer through-thickness temperature gradients to a later iteration.
- Illumination is from the top only.
- Radiating surfaces are user-selectable:
  - Top surface only.
  - Bottom surface only.
  - Both surfaces.
- Default radiating surface mode is both surfaces.
- The observed radiation shown in the visualization and plots is the emitted radiation.
- Material presets use plausible values, not authoritative measured datasets.
- Absorptivity and emissivity are wavelength-dependent curves in version 1.
- Radiation spectrum presets use compact approximations for now.
- Convection was excluded from version 1; version 2 adds an optional air-side heat-exchange model that lumps conduction and convection (see 4.7).
- Keep the app simple and in-browser. Export features are deferred.
- Use plain HTML and JavaScript for this iteration. A small library is acceptable if it materially improves plotting or UI quality. (Version 2 adopts the vendored uPlot library for all charts.)
- Use SI units only in the interface and code.
- In code and JSON, use `snake_case` field names. Do not encode units with camelCase. Preserve unit casing in unit suffixes, for example `specific_heat_J_kg_K`, not `specificHeatJKgK`.

## 3. Target User Experience

The first screen is the simulator itself.

Desktop layout:

- Left panel: material, geometry, radiation, environment, air convection, and playback controls.
- Center stage: animated horizontal slab with incoming illumination from above and emitted radiation leaving the active surface or surfaces.
- Right or lower panel: live readouts and plots.

Mobile layout:

- Top: compact temperature and power readouts plus play controls.
- Middle: animated slab visualization.
- Below: collapsible parameter groups and plots.

The simulation runs in real time while playing. Users can pause, reset, change playback speed, switch material presets, switch radiation spectrum presets, and edit parameters. Edits should update the model immediately.

## 4. Physics Model

### 4.1 Slab Model

The slab is a horizontal rectangular plate with:

- Area `A` in m^2.
- Thickness `L` in m.
- Density `rho` in kg/m^3.
- Specific heat capacity `c_p` in J/(kg K).
- Thermal conductivity `k_slab` in W/(m K).
- Initial temperature `T_0` in K.
- Wavelength-dependent absorptivity `alpha(lambda)`.
- Wavelength-dependent emissivity `epsilon(lambda)`.

Version 1 uses a lumped thermal capacitance model:

```text
C dT/dt = P_abs + P_air - P_rad_net
C = rho * A * L * c_p
```

where `C` is the slab heat capacity in J/K.

This assumes the whole slab has one temperature. The UI should label this clearly as a "uniform slab temperature" model. The thermal conductivity value is still included in presets and controls because it will matter for later internal conduction modelling, but it does not create a through-thickness gradient in version 1.

### 4.2 Incident Radiation

Incident spectral irradiance is represented as:

```text
E_inc(lambda) [W m^-2 m^-1]
```

UI plots may show wavelengths in m. If readability becomes poor, a later UI-only display conversion to nm can be considered, but stored values and calculations remain SI.

Illumination is from above. The incidence angle defaults to 0 degrees, meaning normal illumination.

Absorbed power is:

```text
P_abs = A * cos(theta) * integral(E_inc(lambda) * alpha(lambda) d lambda)
```

where:

- `theta` is the incidence angle from the surface normal.
- `alpha(lambda)` is interpolated from the selected material absorptivity curve.
- The spectrum is integrated numerically over the sampled wavelength range.

If a preset material only has a grey estimated absorptivity, represent it internally as a flat spectral curve across the app wavelength range.

### 4.3 Thermal Emission

The emitted spectral exitance follows Planck's law:

```text
M_bb(lambda, T) = (2 * pi * h * c^2) / (lambda^5 * (exp(h * c / (lambda * k_B * T)) - 1))
```

Emitted spectral power for one emitting face:

```text
P_emit_spectral(lambda) = A * epsilon(lambda) * M_bb(lambda, T)
```

For radiative exchange with an environment at temperature `T_env`, use net radiative loss:

```text
P_rad_net = sum_over_active_faces(
  A * integral(epsilon_face(lambda) * (M_bb(lambda, T) - M_bb(lambda, T_env)) d lambda)
)
```

For performance, the grey-body Stefan-Boltzmann shortcut may be used only for approximate readouts or when the emissivity curve is flat:

```text
P_rad_net = n_faces * A * epsilon * sigma * (T^4 - T_env^4)
```

Active emitting faces are user-selectable:

- `top`
- `bottom`
- `both`

The default is `both`. Illumination remains top-only regardless of emitting-face selection.

### 4.4 Emitted Radiation As The Observed Radiation

For version 1, "observed radiation" means radiation emitted by the slab.

The visualization should emphasize:

- Emitted waves leaving the selected active surface or surfaces.
- Emitted intensity increasing strongly as temperature rises.
- Emitted spectral peak shifting with temperature.

Reflected incoming radiation can be omitted from version 1 or shown only as a secondary cue. The primary observed radiation plot is the emitted spectrum.

### 4.5 Conduction (removed in version 2)

Earlier versions included an optional abstract solid-conduction path between the slab and a
fixed-temperature boundary, `P_cond = G_cond * (T_boundary - T)`, with direct-conductance and
geometry-based input modes. It was removed: the air-side heat-exchange model (§4.7) covers the
non-radiative path, and its coefficient mode is the same linear `G * dT` form, so it subsumes the
old conduction term. The only thing lost is a second, simultaneous non-radiative path to a different
reservoir (e.g. air on one face and a solid mount on the other), which is out of scope. The slab is
otherwise treated as magically suspended; its only optional non-radiative exchange is air convection.

### 4.6 Energy Balance

At each internal simulation step:

```text
P_net = P_abs + P_air - P_rad_net
dT = (P_net / C) * dt
T_next = T + dT
```

`P_air` is the optional air-side heat-exchange term (lumped conduction + convection); it is zero
unless air convection is enabled (see 4.7).

The simulation is near equilibrium when:

```text
abs(P_net) < tolerance_W
```

or:

```text
abs(dT/dt) < tolerance_K_s
```

The UI should show:

- Current slab temperature in K.
- Estimated equilibrium temperature in K.
- Absorbed power in W.
- Net emitted radiative power in W.
- Air convection power in W, signed, when enabled (see 4.7).
- Net power in W.
- Simulated elapsed time in s.

### 4.7 Air-Side Heat Exchange (Convection + Air-Film Conduction)

Version 1 modelled the slab as exchanging heat only by radiation. This optional air-side
heat-exchange term adds natural convection, forced convection, and the conduction-limited air-film
floor, lumped into a single per-face coefficient `h` — the slab's only non-radiative path.

This term is OFF by default. With it off the power balance is unchanged and the radiative-only
equilibrium is preserved exactly.

The model couples to two independent reservoirs:

- `environment.temperature_K` - the radiative sky/background (Stefan-Boltzmann sink).
- `convection.air_temperature_K` - the surrounding air (convective sink).

These are physically distinct (a clear night sky may be ~230 K radiatively while the air is ~280 K)
and are not merged. `air_temperature_K` defaults to 293.15 K.

Energy contribution, signed positive when the air is warmer than the slab:

```text
P_air = sum over active faces of  h_face * area * (air_temperature_K - T_slab)
P_net = P_abs + P_air - P_rad_net
```

Because `P_air` is strictly decreasing in `T_slab` (slope -sum(h*area) < 0) it keeps `P_net(T)`
monotonic, so the bisection equilibrium solver retains a unique root.

Coefficient mode: the user supplies one combined `h_coefficient_W_m2_K`, applied to every active face.

Correlation mode: air properties are evaluated at the film temperature `T_film = (T_slab + T_air)/2`
each step, scaled from 300 K / 1 atm references (k = 0.0263 W/m/K, nu = 1.589e-5 m^2/s,
alpha = 2.25e-5 m^2/s, Pr = 0.707, beta = 1/T_film). An optional `pressure_scale` (P/P0) divides
`nu` and `alpha` (both proportional to 1/density).

```text
Ra = g * beta * |T_slab - T_air| * L_natural^3 / (nu * alpha)
Re = wind_speed * L_forced / nu
```

Characteristic lengths differ by mechanism: horizontal natural convection uses
`L_natural = A/P = sqrt(area)/4` (square-plate assumption); forced flow uses `L_forced = sqrt(area)`.
A positive `characteristic_length_m` overrides the auto value.

Natural Nusselt (per face) is selected jointly by orientation AND the sign of `T_slab - T_air`:

- Buoyant case (top face hot, or bottom face cold): `Nu_n = 0.54 * Ra^(1/4)` for `Ra < 1e7`,
  else `0.15 * Ra^(1/3)`.
- Suppressed case (top face cold, or bottom face hot): `Nu_n = 0.27 * Ra^(1/4)`.

Forced Nusselt (flat plate, transition fixed at Re = 5e5, where the curve is continuous):

- `Re < 5e5`:  `Nu_f = 0.664 * Re^(1/2) * Pr^(1/3)` (laminar).
- `Re >= 5e5`: `Nu_f = (0.037 * Re^(4/5) - 871) * Pr^(1/3)` (combined laminar + turbulent).

Each Nusselt is floored at 1 (the air-film conduction limit `h >= k/L`), so still air gives a finite,
non-zero loss and the equilibrium solver does not stall at `T_slab = T_air`. Per-face coefficients
combine transversely on `h`:

```text
h_n = Nu_n * k / L_natural
h_f = (wind > 0) ? Nu_f * k / L_forced : 0
h_face = (h_n^3 + h_f^3)^(1/3)
```

Only transverse/assisting mixed flow is modelled; opposing flow is out of scope. Top and bottom faces
get different `h` because they take different natural-convection branches.

Numerical note: convection raises the effective conductance and shortens the stable explicit-Euler
step, so the integrator sizes its internal sub-step adaptively, `dt = min(0.25, 0.5 * C / G_eff)`,
with `G_eff = 4 * eps_bar * sigma * area * T^3 * faces + G_cond + sum(h * area)`. Thin, low-rho-cp
coatings in strong wind are the stiff case.

Regime note: with radiation only, a low-emissivity polished surface (e.g. polished aluminium) settles
HOTTER than a high-emissivity matte-black surface under the same irradiance, because it cannot radiate
its absorbed heat away. Air convection adds a parallel, emissivity-independent loss path; under
appreciable wind the convective term can dominate and compress or even invert that polished-vs-black
gap. The convection toggle is therefore the key control for distinguishing radiation-limited from
convection-limited thermal behaviour.

Parameters (`state.convection`): `enabled` (false); `mode` ("coefficient" | "correlation", default
"coefficient"); `air_temperature_K` (293.15); `h_coefficient_W_m2_K` (10); `wind_speed_m_s` (0);
`characteristic_length_m` (0 = auto); `air_thermal_conductivity_ref_W_m_K` (0.0263);
`air_kinematic_viscosity_ref_m2_s` (1.589e-5); `air_thermal_diffusivity_ref_m2_s` (2.25e-5);
`air_prandtl_number` (0.707); `pressure_scale` (1.0). Constants: g = 9.80665 m/s^2,
convection_blend_exponent = 3, transition Reynolds = 5e5.

## 5. Presets

### 5.1 Material Presets

Presets populate multiple fields while still allowing manual edits.

Initial material presets:

- Polished aluminium.
- Anodized aluminium.
- Matte black paint.
- White paint.
- Stainless steel.
- Copper.
- Generic ceramic.
- Custom material.

Each material preset should include plausible thermal properties and wavelength-dependent absorptivity and emissivity curves. Curves can be compact and approximate in version 1.

Example:

```json
{
  "id": "polished_aluminium",
  "label": "Polished aluminium",
  "density_kg_m3": 2700,
  "specific_heat_J_kg_K": 900,
  "thermal_conductivity_W_m_K": 205,
  "thickness_m": 0.002,
  "area_m2": 0.01,
  "absorptivity_curve": [
    { "wavelength_m": 3.0e-7, "value": 0.12 },
    { "wavelength_m": 7.0e-7, "value": 0.09 },
    { "wavelength_m": 1.0e-5, "value": 0.04 }
  ],
  "emissivity_curve": [
    { "wavelength_m": 3.0e-7, "value": 0.12 },
    { "wavelength_m": 7.0e-7, "value": 0.09 },
    { "wavelength_m": 1.0e-5, "value": 0.04 }
  ],
  "notes": "Plausible educational values; actual values vary strongly with alloy, finish, oxide layer, and wavelength."
}
```

### 5.2 Radiation Spectrum Presets

Spectrum presets define incident spectral irradiance over wavelength.

Initial spectrum presets:

- Solar radiation at Earth's surface, compact AM1.5-like approximation.
- Solar radiation in Earth orbit, compact AM0-like approximation.
- Blackbody source with configurable temperature and irradiance scale.
- Monochromatic or narrow-band source.
- Infrared heater approximation.
- Custom simple spectrum entered by the user, if it can be kept lightweight.

Example:

```json
{
  "id": "solar_am15_compact",
  "label": "Solar at Earth's surface, compact AM1.5-like",
  "wavelength_unit": "m",
  "irradiance_unit": "W_m2_m",
  "total_irradiance_W_m2": 1000,
  "samples": [
    { "wavelength_m": 2.8e-7, "irradiance_W_m2_m": 0.0 },
    { "wavelength_m": 5.0e-7, "irradiance_W_m2_m": 1.8e9 },
    { "wavelength_m": 1.5e-6, "irradiance_W_m2_m": 2.0e8 }
  ],
  "notes": "Compact approximation for interactive simulation; replace with sourced spectral data later if needed."
}
```

## 6. Main Controls

### 6.1 Material

- Material preset selector.
- Density `rho` in kg/m^3.
- Specific heat capacity `c_p` in J/(kg K).
- Thermal conductivity `k_slab` in W/(m K).
- Slab thickness `L` in m.
- Slab area `A` in m^2.
- Absorptivity curve editor or compact curve selector.
- Emissivity curve editor or compact curve selector.

For the first implementation, curve editing can be simple:

- Show the current curve as a mini plot.
- Allow preset selection.
- Allow a flat value to be converted into a constant curve.
- Defer detailed point-by-point editing if it slows down the first build.

### 6.2 Radiation

- Spectrum preset selector.
- Irradiance scale factor.
- Incidence angle in degrees.
- Wavelength range in m.
- Show incident spectrum toggle.

Degrees are acceptable for incidence angle as a UI convention. Store angle fields with an explicit `_deg` suffix and convert to radians only inside calculation functions when needed.

### 6.3 Environment

- Environment temperature `T_env` in K.
- Initial slab temperature `T_0` in K.
- Active emitting faces:
  - Top.
  - Bottom.
  - Both.

Default:

```text
T_env = 293.15 K
T_0 = 293.15 K
active_faces = both
```

### 6.4 Air Convection

- Enable air-side heat exchange toggle.
- Mode: direct coefficient, or computed (natural + forced correlations).
- Air temperature `T_air` in K.
- Coefficient `h` in W/(m^2 K) (coefficient mode).
- Wind speed in m/s and characteristic length in m (correlation mode).
- Advanced: sea-level air properties (k, nu, alpha, Pr) and a pressure scale (P/P0).

Default:

```text
convection_enabled = false
```

When disabled, `P_air = 0`. See §4.7 for the model.

### 6.5 Playback

- Play/pause.
- Reset.
- Speed selector:
  - `0.1x`
  - `1x`
  - `10x`
  - `100x`
  - `1000x`
- Optional numerical stability indicator.

## 7. Visualization

The center visualization should show:

- A horizontal slab.
- Incoming radiation from above.
- Emitted radiation leaving the selected emitting surface or surfaces.
- Optional air-convection heat-flow animation when air convection is enabled.
- Slab color changing with temperature.

Visual encodings:

- Incident radiation: yellow or white downward waves/rays.
- Emitted radiation: red/orange waves leaving the slab.
- Air convection: purple arrows, toward the slab when the air warms it, away when it cools the slab.
- Slab color: cool blue through neutral grey to orange/red.

The animation is qualitative. Quantitative values belong in readouts and plots.

The emitted radiation animation should respond to:

- Current emitted power.
- Selected emitting faces.
- Temperature-driven spectrum shift.

## 8. Plots And Readouts

Minimum readouts:

- Temperature `T` in K.
- Equilibrium temperature estimate in K.
- Absorbed power `P_abs` in W.
- Net emitted radiation power `P_rad_net` in W.
- Air convection power `P_air` in W.
- Net power `P_net` in W.
- Simulated time in s.

Minimum plots:

- Temperature vs simulated time.
- Power balance vs simulated time:
  - `P_abs`
  - `P_rad_net`
  - `P_air`
  - `P_net`
- Emitted spectrum:
  - `P_emit_spectral(lambda)` or spectral exitance.
  - Updates live as temperature changes.
  - Logarithmic wavelength axis.
  - The area under the curve is filled with the visible colour of each wavelength: a rainbow
    across 380-780 nm fading through deep red into a faint warm tone in the infrared, so the
    plot itself shows how much of the emission is visible light versus invisible IR.

The material absorptivity/emissivity mini-plots use the same log wavelength axis (displayed in
nm) and the same spectral-colour underlay.

Optional plots:

- Incident spectrum.
- Absorbed spectrum.
- Equilibrium marker on temperature plot.

Charts are rendered with the vendored uPlot library (`src/vendor/`, MIT). Chart data is pushed
on change (new history samples at ~10 Hz, parameter/equilibrium updates) rather than redrawn
every animation frame; only the slab visualization canvas draws per frame.

## 9. Simulation Engine Design

### 9.1 State Shape

Use plain JavaScript objects with snake_case names. Include units in names where useful, preserving SI unit casing.

Example state:

```js
const simulation_state = {
  running: false,
  sim_time_s: 0,
  temperature_K: 293.15,
  initial_temperature_K: 293.15,
  playback_rate: 1,
  material: material_config,
  radiation: radiation_config,
  environment: environment_config,
  convection: convection_config,
  history: []
};
```

Material config:

```js
const material_config = {
  preset_id: "polished_aluminium",
  density_kg_m3: 2700,
  specific_heat_J_kg_K: 900,
  thermal_conductivity_W_m_K: 205,
  thickness_m: 0.002,
  area_m2: 0.01,
  absorptivity_curve: [],
  emissivity_curve: []
};
```

Radiation config:

```js
const radiation_config = {
  preset_id: "solar_am15_compact",
  incidence_angle_deg: 0,
  irradiance_scale: 1,
  spectrum: []
};
```

Environment config:

```js
const environment_config = {
  temperature_K: 293.15,
  active_faces: "both"
};
```

Convection config:

```js
const convection_config = {
  enabled: false,
  mode: "coefficient",
  air_temperature_K: 293.15,
  h_coefficient_W_m2_K: 10,
  wind_speed_m_s: 0,
  characteristic_length_m: 0,
  air_thermal_conductivity_ref_W_m_K: 0.0263,
  air_kinematic_viscosity_ref_m2_s: 1.589e-5,
  air_thermal_diffusivity_ref_m2_s: 2.25e-5,
  air_prandtl_number: 0.707,
  pressure_scale: 1
};
```

Simulation sample:

```js
const sample = {
  sim_time_s: 0,
  temperature_K: 293.15,
  absorbed_power_W: 0,
  emitted_power_W: 0,
  convective_air_power_W: 0,
  net_power_W: 0
};
```

### 9.2 Numerical Integration

Use `requestAnimationFrame` for rendering and a fixed or semi-fixed internal time step for simulation.

Process:

```text
wall_dt_s = current_frame_time_s - previous_frame_time_s
target_sim_dt_s = wall_dt_s * playback_rate
internal_dt_s = min(remaining_target_dt_s, max_internal_dt_s)
repeat until target_sim_dt_s is consumed
```

Explicit Euler is acceptable for version 1 if the internal time step is capped. If high playback speeds visibly overshoot equilibrium, switch to RK4 or a smaller `max_internal_dt_s`.

### 9.3 Equilibrium Estimate

When parameters change, estimate equilibrium temperature by solving:

```text
P_abs + P_air(T) - P_rad_net(T) = 0
```

Use bisection:

- Lower bound: 1 K.
- Initial upper bound: 3000 K.
- Expand upper bound if net power remains positive.
- Stop when net power or temperature interval is within tolerance.

Temperature warnings:

- Hard invalid: `T <= 0 K`.
- Warn below `100 K`, because many preset assumptions may be poor.
- Warn above `1000 K`, because coatings, oxidation, and material limits may dominate.
- Add material-specific warning thresholds later, for example aluminium melting near 933 K.

## 10. Units And Validation

Use SI units only.

Internal and displayed units:

- Temperature: K.
- Length: m.
- Area: m^2.
- Density: kg/m^3.
- Specific heat capacity: J/(kg K).
- Thermal conductivity: W/(m K).
- Convective heat transfer coefficient: W/(m^2 K).
- Irradiance: W/m^2 or spectral W/(m^2 m).
- Wavelength: m.
- Time: s.
- Power: W.

Validation:

- Thickness, area, density, specific heat, and heat capacity must be positive.
- Thermal conductivity must be non-negative.
- Emissivity and absorptivity curve values must be between 0 and 1.
- Temperature must be greater than 0 K.
- Incidence angle should be 0 to 90 degrees.
- Spectrum wavelengths must be positive and sorted.
- Spectrum irradiance values must be non-negative.
- When air convection is enabled: air temperature must be between 0 and 3000 K; the coefficient, wind speed, and characteristic length must be non-negative; air properties and pressure scale must be positive.

Invalid inputs should show inline errors and pause simulation advancement until corrected.

## 11. Implementation Architecture

Use a plain HTML/JavaScript single-page app. Prefer no build step for version 1 unless a library makes one necessary.

Recommended structure:

```text
index.html
src/
  main.js
  state.js
  controls.js
  visualization.js
  plots.js
  simulation/
    constants.js
    planck.js
    spectra.js
    materials.js
    interpolation.js
    integration.js
    thermal_model.js
    equilibrium.js
    validation.js
  styles/
    app.css
  vendor/
    uPlot.iife.min.js
    uPlot.min.css
```

Core separation:

- `simulation/` contains pure calculation functions.
- UI modules read and write state but do not own physics formulas.
- Presets are data objects, not embedded inside UI handlers.
- Visualization consumes computed powers, temperatures, and active faces.
- Plot modules consume history and spectral arrays.

Suggested browser technologies:

- HTML controls for inputs and selectors.
- CSS grid/flexbox for layout.
- Canvas or SVG for the slab visualization.
- Plots use the vendored uPlot library (canvas-based, no build step required).

## 12. Testing Strategy

Physics tests:

- Planck function returns finite positive values over expected wavelengths and temperatures.
- Integrated blackbody exitance approximates `sigma * T^4` within tolerance.
- Spectrum integration gives expected total irradiance for known sample arrays.
- Interpolation of absorptivity and emissivity curves clamps or handles edge wavelengths consistently.
- Air convection power sign is correct:
  - Air hotter than slab gives positive power.
  - Air colder than slab gives negative power.
- Equilibrium solver returns a temperature where net power is near zero.

UI tests:

- Material preset populates expected fields and curves.
- Spectrum preset changes incident power.
- Active face selection changes emitted power and animation direction.
- Play/pause changes whether simulated time advances.
- Reset restores initial temperature and clears history.
- Invalid emissivity, thickness, or spectrum values show validation feedback.

Visual/manual checks:

- Incoming radiation appears from above.
- Emitted radiation leaves the selected surface or surfaces.
- Emitted radiation intensity changes with temperature.
- Air convection arrows appear only when air convection is enabled.
- Air convection arrows reverse direction correctly.
- Plots update smoothly at supported playback speeds.

## 13. Version 1 Scope

Included:

- Plain HTML/JavaScript single-page app.
- Single uniform-temperature slab.
- Top-only illumination.
- User-selectable emitting surfaces with both as default.
- Wavelength-dependent absorptivity and emissivity curves.
- Compact approximate radiation spectrum presets.
- Real-time temperature integration.
- Live emitted radiation visualization.
- Emitted spectrum plot.
- Temperature and power balance plots.
- Optional air-side heat exchange: lumped conduction plus natural and forced convection (see 4.7).
- Playback speed controls.
- Plausible material presets.
- SI-only controls and readouts.

Deferred:

- Through-thickness temperature gradients.
- Multilayer coatings.
- High-accuracy sourced material optical datasets.
- High-accuracy AM0/AM1.5 reference spectra.
- Physical support, backing plate, or mount models.
- Opposing-flow mixed convection, non-horizontal surfaces, and full turbulence modelling; only transverse natural + forced flat-plate correlations are included (see 4.7).
- Evaporation, phase change, melting, or temperature-dependent material properties.
- Full radiosity or view-factor modelling.
- Cloud cover, atmospheric humidity, and time-of-day solar geometry.
- Exporting plots, CSV history, or preset configurations.

## 14. Known Simplifications

- The slab is treated as isothermal.
- Preset values are plausible educational defaults, not guaranteed measured values.
- Absorptivity and emissivity curves are compact approximations.
- Solar spectra are compact approximations.
- Animated waves are illustrative, not a wave-optics simulation.
- Air-side heat exchange uses one lumped film coefficient per face from standard flat-plate correlations; it does not resolve the boundary-layer flow field.
- Radiation exchange uses a simple environment temperature, not a full enclosure model.

## 15. Remaining Clarification

Resolved: the version 1 abstract solid-conduction path was removed in version 2 in favour of the
air-side heat-exchange model (§4.7), which covers the non-radiative path with physically grounded
convection. The slab is otherwise visually and conceptually suspended; no support, mount, or backing
plate is modelled. Solid-contact conduction to a separate boundary could return later alongside a
through-thickness model if a concrete use case arises.
