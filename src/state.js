(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function clone_json(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create_default_state() {
    const spectrum_presets = ns.create_spectrum_presets();
    const material_preset = ns.material_presets.find((preset) => preset.id === "anodized_aluminium") || ns.material_presets[0];
    const spectrum_preset = spectrum_presets.find((preset) => preset.id === "solar_am15_compact") || spectrum_presets[0];

    return {
      running: false,
      sim_time_s: 0,
      temperature_K: 293.15,
      initial_temperature_K: 293.15,
      playback_rate: 1,
      material: ns.clone_material_preset(material_preset),
      radiation: {
        preset_id: spectrum_preset.id,
        incidence_angle_deg: 30,
        irradiance_scale: 1,
        source_temperature_K: spectrum_preset.source_temperature_K,
        spectrum: spectrum_preset.create_spectrum(spectrum_preset.source_temperature_K)
      },
      environment: {
        temperature_K: 293.15,
        active_faces: "both"
      },
      convection: {
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
      },
      history: [],
      last_powers: null,
      equilibrium_temperature_K: null,
      needs_equilibrium_update: true
    };
  }

  ns.clone_json = clone_json;
  ns.spectrum_presets = ns.create_spectrum_presets();
  ns.app_state = create_default_state();
  ns.create_default_state = create_default_state;
})(window);
