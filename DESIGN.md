# Electromagnetic Heating Slab Simulator Design

## 1. Purpose

Build a simple browser-based web app that simulates how a horizontal material slab approaches thermal equilibrium when illuminated from above by electromagnetic radiation.

The app should make the energy balance visible in real time:

- Incoming spectral radiation heats the slab according to wavelength-dependent absorptivity.
- The slab emits thermal radiation according to its temperature and wavelength-dependent emissivity.
- Optional conductive heat exchange can add or remove heat through the selected active surface model.
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
- Convection is excluded from version 1.
- Keep the app simple and in-browser. Export features are deferred.
- Use plain HTML and JavaScript for this iteration. A small library is acceptable if it materially improves plotting or UI quality.
- Use SI units only in the interface and code.
- In code and JSON, use `snake_case` field names. Do not encode units with camelCase. Preserve unit casing in unit suffixes, for example `specific_heat_J_kg_K`, not `specificHeatJKgK`.

## 3. Target User Experience

The first screen is the simulator itself.

Desktop layout:

- Left panel: material, geometry, radiation, environment, conduction, and playback controls.
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
C dT/dt = P_abs + P_cond - P_rad_net
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

### 4.5 Conduction

The app still needs a conduction term and conduction controls, but version 1 should avoid modelling a physical support, backing plate, or ambient contact. The slab can be treated as magically suspended unless the user enables a simplified conductive exchange path.

Recommended version 1 interpretation:

- Conduction is an optional abstract heat path between the slab and a fixed-temperature boundary.
- The boundary is not drawn as a support or mount.
- The conduction animation shows heat entering or leaving the selected active surface model.
- If the user selects one active surface, conduction is associated with that surface.
- If the user selects both active surfaces, conduction can be applied to both surfaces using a shared conductance value.

Conduction power:

```text
P_cond = G_cond * (T_boundary - T)
```

where:

- `G_cond` is thermal conductance in W/K.
- `T_boundary` is the abstract boundary temperature in K.
- Positive `P_cond` heats the slab.
- Negative `P_cond` cools the slab.

The UI can provide two equivalent input modes:

Direct conductance:

```text
G_cond [W/K]
```

Geometry-based conductance:

```text
G_cond = k_cond * A_contact / d_cond
```

where:

- `k_cond` is conductor thermal conductivity in W/(m K).
- `A_contact` is contact area in m^2.
- `d_cond` is path length in m.

This remains a lumped heat exchange term. It does not model a temperature profile inside the slab.

### 4.6 Energy Balance

At each internal simulation step:

```text
P_net = P_abs + P_cond - P_rad_net
dT = (P_net / C) * dt
T_next = T + dT
```

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
- Conductive power in W, signed.
- Net power in W.
- Simulated elapsed time in s.

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

### 6.4 Conduction

- Enable conduction toggle.
- Direct conductance mode or geometry mode.
- Boundary temperature `T_boundary` in K.
- Conductance `G_cond` in W/K.
- Contact area `A_contact` in m^2.
- Path length `d_cond` in m.
- Conductor thermal conductivity `k_cond` in W/(m K).

Default:

```text
conduction_enabled = false
```

When disabled, `P_cond = 0`.

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
- Optional conduction heat-flow animation when conduction is enabled.
- Slab color changing with temperature.

Visual encodings:

- Incident radiation: yellow or white downward waves/rays.
- Emitted radiation: red/orange waves leaving the slab.
- Conductive heat into slab: red arrows toward the slab.
- Conductive heat out of slab: blue arrows away from the slab.
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
- Conductive power `P_cond` in W.
- Net power `P_net` in W.
- Simulated time in s.

Minimum plots:

- Temperature vs simulated time.
- Power balance vs simulated time:
  - `P_abs`
  - `P_rad_net`
  - `P_cond`
  - `P_net`
- Emitted spectrum:
  - `P_emit_spectral(lambda)` or spectral exitance.
  - Updates live as temperature changes.

Optional plots:

- Incident spectrum.
- Absorbed spectrum.
- Equilibrium marker on temperature plot.

For a plain HTML/JavaScript implementation, use SVG or canvas directly unless a plotting library substantially reduces complexity.

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
  conduction: conduction_config,
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

Conduction config:

```js
const conduction_config = {
  enabled: false,
  mode: "direct",
  conductance_W_K: 0,
  boundary_temperature_K: 293.15,
  contact_area_m2: 0.0,
  path_length_m: 0.0,
  conductor_thermal_conductivity_W_m_K: 0.0
};
```

Simulation sample:

```js
const sample = {
  sim_time_s: 0,
  temperature_K: 293.15,
  absorbed_power_W: 0,
  emitted_power_W: 0,
  conductive_power_W: 0,
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
P_abs + P_cond(T) - P_rad_net(T) = 0
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
- Conductance: W/K.
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
- Conductance must be non-negative.
- In geometry conduction mode, contact area, path length, and conductor thermal conductivity must be positive.

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
- Canvas or SVG for plots unless a small plotting library is clearly worth it.

## 12. Testing Strategy

Physics tests:

- Planck function returns finite positive values over expected wavelengths and temperatures.
- Integrated blackbody exitance approximates `sigma * T^4` within tolerance.
- Spectrum integration gives expected total irradiance for known sample arrays.
- Interpolation of absorptivity and emissivity curves clamps or handles edge wavelengths consistently.
- Conductive power sign is correct:
  - Boundary hotter than slab gives positive power.
  - Boundary colder than slab gives negative power.
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
- Conduction arrows appear only when conduction is enabled.
- Conduction arrows reverse direction correctly.
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
- Optional abstract conduction heat path.
- Playback speed controls.
- Plausible material presets.
- SI-only controls and readouts.

Deferred:

- Through-thickness temperature gradients.
- Multilayer coatings.
- High-accuracy sourced material optical datasets.
- High-accuracy AM0/AM1.5 reference spectra.
- Physical support, backing plate, or mount models.
- Convection.
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
- Conductive exchange is a lumped abstract heat path, not a resolved physical object.
- Radiation exchange uses a simple environment temperature, not a full enclosure model.

## 15. Remaining Clarification

The only remaining design ambiguity is conduction:

- The current design keeps conduction as an optional abstract heat path to a fixed-temperature boundary.
- The slab is otherwise visually and conceptually suspended.
- No support, mount, backing plate, or ambient contact is modelled in version 1.

Please confirm whether this matches the intended meaning of "conduction" for the first implementation. If not, conduction should probably be deferred until the later through-thickness model.
