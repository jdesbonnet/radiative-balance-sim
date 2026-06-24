(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  const ids = [
    "play_pause_button",
    "reset_button",
    "playback_rate",
    "material_preset",
    "density_kg_m3",
    "specific_heat_J_kg_K",
    "thermal_conductivity_W_m_K",
    "thickness_m",
    "area_m2",
    "absorptivity_curve",
    "emissivity_curve",
    "radiation_enabled",
    "radiation_preset",
    "irradiance_scale",
    "incidence_angle_deg",
    "source_temperature_K",
    "initial_temperature_K",
    "environment_temperature_K",
    "active_faces",
    "convection_enabled",
    "convection_mode",
    "air_temperature_K",
    "h_coefficient_W_m2_K",
    "wind_speed_m_s",
    "characteristic_length_m",
    "air_thermal_conductivity_ref_W_m_K",
    "air_kinematic_viscosity_ref_m2_s",
    "air_thermal_diffusivity_ref_m2_s",
    "air_prandtl_number",
    "pressure_scale",
    "validation_messages",
    "temperature_readout",
    "equilibrium_readout",
    "absorbed_power_readout",
    "emitted_power_readout",
    "convective_power_readout",
    "net_power_readout",
    "sim_time_readout",
    "irradiance_readout",
    "absorptivity_curve_plot",
    "emissivity_curve_plot"
  ];

  const el = {};

  function number_value(id) {
    return Number(el[id].value);
  }

  function set_number(id, value) {
    el[id].value = Number(value).toPrecision(8).replace(/\.?0+$/, "");
  }

  function format_number(value, unit, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "-";
    }
    const abs_value = Math.abs(value);
    let formatted;
    if ((abs_value > 0 && abs_value < 0.001) || abs_value >= 100000) {
      formatted = value.toExponential(digits || 3);
    } else {
      formatted = value.toLocaleString(undefined, {
        maximumFractionDigits: digits === undefined ? 3 : digits,
        minimumFractionDigits: digits === undefined ? 0 : digits
      });
    }
    return `${formatted} ${unit}`;
  }

  function populate_selects() {
    for (const preset of ns.material_presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      el.material_preset.appendChild(option);
    }

    for (const preset of ns.spectrum_presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      el.radiation_preset.appendChild(option);
    }
  }

  function selected_spectrum_preset() {
    return ns.spectrum_presets.find((preset) => preset.id === el.radiation_preset.value) || ns.spectrum_presets[0];
  }

  function apply_material_preset(state, preset_id) {
    const preset = ns.material_presets.find((item) => item.id === preset_id);
    if (!preset) {
      return;
    }
    state.material = ns.clone_material_preset(preset);
    state.material.preset_id = preset.id;
    state.needs_equilibrium_update = true;
    state.needs_visual_update = true;
    sync_controls_from_state(state);
  }

  function apply_radiation_preset(state, preset_id) {
    const preset = ns.spectrum_presets.find((item) => item.id === preset_id);
    if (!preset) {
      return;
    }

    state.radiation.preset_id = preset.id;
    state.radiation.source_temperature_K = preset.source_temperature_K;
    state.radiation.spectrum = preset.create_spectrum(preset.source_temperature_K);
    state.needs_equilibrium_update = true;
    state.needs_visual_update = true;
    sync_controls_from_state(state);
  }

  function sync_radiation_control_state(state) {
    const radiation_enabled = state.radiation.enabled !== false;
    el.radiation_preset.disabled = !radiation_enabled;
    el.irradiance_scale.disabled = !radiation_enabled;
    el.incidence_angle_deg.disabled = !radiation_enabled;
    el.source_temperature_K.disabled = !radiation_enabled || !selected_spectrum_preset().allows_temperature;
  }

  function sync_controls_from_state(state) {
    el.material_preset.value = state.material.preset_id;
    set_number("density_kg_m3", state.material.density_kg_m3);
    set_number("specific_heat_J_kg_K", state.material.specific_heat_J_kg_K);
    set_number("thermal_conductivity_W_m_K", state.material.thermal_conductivity_W_m_K);
    set_number("thickness_m", state.material.thickness_m);
    set_number("area_m2", state.material.area_m2);
    el.absorptivity_curve.value = ns.curve_to_text(state.material.absorptivity_curve);
    el.emissivity_curve.value = ns.curve_to_text(state.material.emissivity_curve);

    const radiation_enabled = state.radiation.enabled !== false;
    el.radiation_enabled.checked = radiation_enabled;
    el.radiation_preset.value = state.radiation.preset_id;
    set_number("irradiance_scale", state.radiation.irradiance_scale);
    set_number("incidence_angle_deg", state.radiation.incidence_angle_deg);
    set_number("source_temperature_K", state.radiation.source_temperature_K);
    sync_radiation_control_state(state);

    set_number("initial_temperature_K", state.initial_temperature_K);
    set_number("environment_temperature_K", state.environment.temperature_K);
    el.active_faces.value = state.environment.active_faces;

    el.convection_enabled.checked = state.convection.enabled;
    el.convection_mode.value = state.convection.mode;
    set_number("air_temperature_K", state.convection.air_temperature_K);
    set_number("h_coefficient_W_m2_K", state.convection.h_coefficient_W_m2_K);
    set_number("wind_speed_m_s", state.convection.wind_speed_m_s);
    set_number("characteristic_length_m", state.convection.characteristic_length_m);
    set_number("air_thermal_conductivity_ref_W_m_K", state.convection.air_thermal_conductivity_ref_W_m_K);
    set_number("air_kinematic_viscosity_ref_m2_s", state.convection.air_kinematic_viscosity_ref_m2_s);
    set_number("air_thermal_diffusivity_ref_m2_s", state.convection.air_thermal_diffusivity_ref_m2_s);
    set_number("air_prandtl_number", state.convection.air_prandtl_number);
    set_number("pressure_scale", state.convection.pressure_scale);

    el.playback_rate.value = String(state.playback_rate);
    el.play_pause_button.textContent = state.running ? "Pause" : "Play";
    update_curve_plots(state);
  }

  function sync_state_from_controls(state) {
    try {
      state.material.preset_id = el.material_preset.value;
      state.material.density_kg_m3 = number_value("density_kg_m3");
      state.material.specific_heat_J_kg_K = number_value("specific_heat_J_kg_K");
      state.material.thermal_conductivity_W_m_K = number_value("thermal_conductivity_W_m_K");
      state.material.thickness_m = number_value("thickness_m");
      state.material.area_m2 = number_value("area_m2");
      state.material.absorptivity_curve = ns.parse_curve_text(el.absorptivity_curve.value);
      state.material.emissivity_curve = ns.parse_curve_text(el.emissivity_curve.value);

      state.radiation.enabled = el.radiation_enabled.checked;
      state.radiation.preset_id = el.radiation_preset.value;
      state.radiation.irradiance_scale = number_value("irradiance_scale");
      state.radiation.incidence_angle_deg = number_value("incidence_angle_deg");
      state.radiation.source_temperature_K = number_value("source_temperature_K");

      const next_initial_temperature_K = number_value("initial_temperature_K");
      if (!state.running && next_initial_temperature_K !== state.initial_temperature_K) {
        state.temperature_K = next_initial_temperature_K;
        state.sim_time_s = 0;
        state.history = [];
      }
      state.initial_temperature_K = next_initial_temperature_K;
      state.environment.temperature_K = number_value("environment_temperature_K");
      state.environment.active_faces = el.active_faces.value;

      state.convection.enabled = el.convection_enabled.checked;
      state.convection.mode = el.convection_mode.value;
      state.convection.air_temperature_K = number_value("air_temperature_K");
      state.convection.h_coefficient_W_m2_K = number_value("h_coefficient_W_m2_K");
      state.convection.wind_speed_m_s = number_value("wind_speed_m_s");
      state.convection.characteristic_length_m = number_value("characteristic_length_m");
      state.convection.air_thermal_conductivity_ref_W_m_K = number_value("air_thermal_conductivity_ref_W_m_K");
      state.convection.air_kinematic_viscosity_ref_m2_s = number_value("air_kinematic_viscosity_ref_m2_s");
      state.convection.air_thermal_diffusivity_ref_m2_s = number_value("air_thermal_diffusivity_ref_m2_s");
      state.convection.air_prandtl_number = number_value("air_prandtl_number");
      state.convection.pressure_scale = number_value("pressure_scale");

      state.playback_rate = number_value("playback_rate");

      const preset = selected_spectrum_preset();
      if (preset.allows_temperature) {
        state.radiation.spectrum = preset.create_spectrum(state.radiation.source_temperature_K);
      }

      state.needs_equilibrium_update = true;
      state.needs_visual_update = true;
      sync_radiation_control_state(state);
      update_curve_plots(state);
    } catch (error) {
      state.control_parse_error = error.message;
    }
  }

  function reset_simulation(state) {
    state.running = false;
    state.sim_time_s = 0;
    state.temperature_K = state.initial_temperature_K;
    state.history = [];
    state.needs_equilibrium_update = true;
    state.needs_visual_update = true;
    sync_controls_from_state(state);
  }

  function wire_events(state) {
    el.play_pause_button.addEventListener("click", () => {
      state.running = !state.running;
      state.needs_visual_update = true;
      sync_controls_from_state(state);
    });

    el.reset_button.addEventListener("click", () => reset_simulation(state));

    el.material_preset.addEventListener("change", () => apply_material_preset(state, el.material_preset.value));
    el.radiation_preset.addEventListener("change", () => apply_radiation_preset(state, el.radiation_preset.value));

    const input_ids = ids.filter((id) => {
      return ![
        "play_pause_button",
        "reset_button",
        "material_preset",
        "radiation_preset",
        "validation_messages",
        "temperature_readout",
        "equilibrium_readout",
        "absorbed_power_readout",
        "emitted_power_readout",
        "convective_power_readout",
        "net_power_readout",
        "sim_time_readout",
        "irradiance_readout",
        "absorptivity_curve_plot",
        "emissivity_curve_plot"
      ].includes(id);
    });

    for (const id of input_ids) {
      const event_name = el[id].tagName === "SELECT" || el[id].type === "checkbox" || el[id].tagName === "TEXTAREA" ? "change" : "input";
      el[id].addEventListener(event_name, () => {
        state.control_parse_error = null;
        sync_state_from_controls(state);
      });
    }

    document.querySelectorAll("details").forEach((details) => {
      details.addEventListener("toggle", () => update_curve_plots(state));
    });
  }

  function update_curve_plots(state) {
    ns.draw_curve_plot(el.absorptivity_curve_plot, state.material.absorptivity_curve, "#0f766e", "alpha");
    ns.draw_curve_plot(el.emissivity_curve_plot, state.material.emissivity_curve, "#e4572e", "epsilon");
  }

  function update_readouts(state, powers, validation) {
    el.temperature_readout.textContent = format_number(state.temperature_K, "K", 1);
    el.equilibrium_readout.textContent = format_number(state.equilibrium_temperature_K, "K", 1);
    el.absorbed_power_readout.textContent = format_number(powers.absorbed_power_W, "W", 1);
    el.emitted_power_readout.textContent = format_number(powers.emitted_power_W, "W", 1);
    el.convective_power_readout.textContent = format_number(powers.convective_air_power_W, "W", 1);
    el.net_power_readout.textContent = format_number(powers.net_power_W, "W", 1);
    el.sim_time_readout.textContent = format_number(state.sim_time_s, "s", 1);
    el.irradiance_readout.textContent = format_number(powers.total_irradiance_W_m2, "W/m^2", 2);

    if (state.control_parse_error) {
      el.validation_messages.className = "validation_messages error";
      el.validation_messages.textContent = state.control_parse_error;
      return;
    }

    if (validation.errors.length > 0) {
      el.validation_messages.className = "validation_messages error";
      el.validation_messages.textContent = validation.errors.join(" ");
      return;
    }

    if (validation.warnings.length > 0) {
      el.validation_messages.className = "validation_messages warn";
      el.validation_messages.textContent = validation.warnings.join(" ");
      return;
    }

    el.validation_messages.className = "validation_messages";
    el.validation_messages.textContent = state.running ? "Running." : "Paused.";
  }

  function init_controls(state) {
    for (const id of ids) {
      el[id] = document.getElementById(id);
    }
    populate_selects();
    sync_controls_from_state(state);
    wire_events(state);
  }

  ns.control_elements = el;
  ns.init_controls = init_controls;
  ns.sync_controls_from_state = sync_controls_from_state;
  ns.sync_state_from_controls = sync_state_from_controls;
  ns.update_readouts = update_readouts;
  ns.format_number = format_number;
})(window);
