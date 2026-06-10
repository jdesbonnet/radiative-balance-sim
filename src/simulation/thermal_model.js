(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};
  const c = ns.constants;

  function active_face_count(active_faces) {
    return active_faces === "both" ? 2 : 1;
  }

  function heat_capacity_J_K(material) {
    return material.density_kg_m3 *
      material.area_m2 *
      material.thickness_m *
      material.specific_heat_J_kg_K;
  }

  function conductance_W_K(conduction) {
    if (!conduction.enabled) {
      return 0;
    }

    if (conduction.mode === "geometry") {
      if (conduction.path_length_m <= 0) {
        return 0;
      }
      return conduction.conductor_thermal_conductivity_W_m_K *
        conduction.contact_area_m2 /
        conduction.path_length_m;
    }

    return conduction.conductance_W_K;
  }

  function absorbed_power_W(state) {
    const angle_rad = state.radiation.incidence_angle_deg * Math.PI / 180;
    const angle_factor = Math.max(0, Math.cos(angle_rad));
    const absorbed_irradiance_W_m2 = ns.integrate_spectrum_with_curve_W_m2(
      state.radiation.spectrum,
      state.material.absorptivity_curve,
      state.radiation.irradiance_scale
    );
    return state.material.area_m2 * angle_factor * absorbed_irradiance_W_m2;
  }

  function conductive_power_W(state) {
    const g_cond_W_K = conductance_W_K(state.conduction);
    return g_cond_W_K * (state.conduction.boundary_temperature_K - state.temperature_K);
  }

  function emitted_spectrum_samples(state) {
    const face_count = active_face_count(state.environment.active_faces);
    const wavelengths = ns.generate_wavelength_grid_m(2.0e-7, 6.0e-5, 260, true);
    return wavelengths.map((wavelength_m) => {
      const epsilon = ns.interpolate_curve_value(state.material.emissivity_curve, wavelength_m);
      const emitted_W_m = state.material.area_m2 *
        face_count *
        epsilon *
        ns.blackbody_exitance_W_m3(wavelength_m, state.temperature_K);
      return {
        wavelength_m,
        emitted_power_W_m: emitted_W_m
      };
    });
  }

  function net_radiative_power_W(state) {
    const face_count = active_face_count(state.environment.active_faces);
    const wavelengths = ns.generate_wavelength_grid_m(2.0e-7, 6.0e-5, 260, true);
    const samples = wavelengths.map((wavelength_m) => {
      const epsilon = ns.interpolate_curve_value(state.material.emissivity_curve, wavelength_m);
      const slab_exitance = ns.blackbody_exitance_W_m3(wavelength_m, state.temperature_K);
      const env_exitance = ns.blackbody_exitance_W_m3(wavelength_m, state.environment.temperature_K);
      return {
        wavelength_m,
        value: state.material.area_m2 * face_count * epsilon * (slab_exitance - env_exitance)
      };
    });

    return ns.integrate_samples(samples, (point) => point.value);
  }

  function total_incident_irradiance_W_m2(state) {
    return ns.integrate_spectrum_irradiance_W_m2(
      state.radiation.spectrum,
      state.radiation.irradiance_scale
    );
  }

  function compute_powers(state) {
    const p_abs_W = absorbed_power_W(state);
    const p_cond_W = conductive_power_W(state);
    const p_rad_net_W = net_radiative_power_W(state);
    return {
      absorbed_power_W: p_abs_W,
      conductive_power_W: p_cond_W,
      emitted_power_W: p_rad_net_W,
      net_power_W: p_abs_W + p_cond_W - p_rad_net_W,
      total_irradiance_W_m2: total_incident_irradiance_W_m2(state),
      conductance_W_K: conductance_W_K(state)
    };
  }

  function advance_simulation(state, dt_s) {
    const powers = compute_powers(state);
    const capacity_J_K = heat_capacity_J_K(state.material);
    if (capacity_J_K > 0) {
      state.temperature_K = Math.max(1, state.temperature_K + (powers.net_power_W / capacity_J_K) * dt_s);
      state.sim_time_s += dt_s;
    }
    return compute_powers(state);
  }

  ns.active_face_count = active_face_count;
  ns.heat_capacity_J_K = heat_capacity_J_K;
  ns.conductance_W_K = conductance_W_K;
  ns.absorbed_power_W = absorbed_power_W;
  ns.conductive_power_W = conductive_power_W;
  ns.emitted_spectrum_samples = emitted_spectrum_samples;
  ns.net_radiative_power_W = net_radiative_power_W;
  ns.total_incident_irradiance_W_m2 = total_incident_irradiance_W_m2;
  ns.compute_powers = compute_powers;
  ns.advance_simulation = advance_simulation;
})(window);
