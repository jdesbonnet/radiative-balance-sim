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

  function active_faces_list(active_faces) {
    return active_faces === "both" ? ["top", "bottom"] : [active_faces];
  }

  // Dry-air thermophysical properties at the film temperature, scaled from the 300 K / 1 atm
  // reference values by simple power-law fits (k ~ T^0.8, nu and alpha ~ T^1.7). pressure_scale
  // = P/P0 divides nu and alpha (both proportional to 1/density).
  function air_film_properties(T_film_K, conv) {
    const ratio = T_film_K / c.air_film_reference_temperature_K;
    const pressure_scale = conv.pressure_scale > 0 ? conv.pressure_scale : 1;
    return {
      k: conv.air_thermal_conductivity_ref_W_m_K * Math.pow(ratio, 0.80),
      nu: conv.air_kinematic_viscosity_ref_m2_s * Math.pow(ratio, 1.70) / pressure_scale,
      alpha: conv.air_thermal_diffusivity_ref_m2_s * Math.pow(ratio, 1.70) / pressure_scale,
      Pr: conv.air_prandtl_number,
      beta: 1 / T_film_K
    };
  }

  // Natural-convection Nusselt for a horizontal plate. The buoyant branch (0.54/0.15) applies
  // when the face is heated facing up OR cooled facing down; the suppressed branch (0.27)
  // otherwise. Floored at 1 (the air-film conduction limit, h >= k/L).
  function natural_nusselt(Ra, orientation, delta_T) {
    const buoyant = (orientation === "top") === (delta_T > 0);
    let Nu;
    if (buoyant) {
      Nu = Ra < 1e7 ? 0.54 * Math.pow(Ra, 0.25) : 0.15 * Math.pow(Ra, 1 / 3);
    } else {
      Nu = 0.27 * Math.pow(Ra, 0.25);
    }
    return Math.max(1, Nu);
  }

  // Forced-convection Nusselt for a flat plate; transition fixed at Re = 5e5 (the combined
  // laminar+turbulent correlation is continuous there). Only used when there is wind.
  function forced_nusselt(Re, Pr) {
    let Nu;
    if (Re < c.convection_transition_reynolds) {
      Nu = 0.664 * Math.pow(Re, 0.5) * Math.pow(Pr, 1 / 3);
    } else {
      Nu = (0.037 * Math.pow(Re, 0.8) - 871) * Math.pow(Pr, 1 / 3);
    }
    return Math.max(1, Nu);
  }

  // Combined (natural + forced) surface coefficient per active face, in W/(m^2 K).
  function convective_h_per_face_W_m2_K(state) {
    const conv = state.convection;
    const area_m2 = state.material.area_m2;
    const T_film_K = 0.5 * (state.temperature_K + conv.air_temperature_K);
    if (!(T_film_K > 0) || !(area_m2 > 0)) {
      return [];
    }
    const props = air_film_properties(T_film_K, conv);
    if (!(props.k > 0) || !(props.nu > 0) || !(props.alpha > 0)) {
      return [];
    }
    const override_m = conv.characteristic_length_m;
    const L_forced_m = override_m > 0 ? override_m : Math.sqrt(area_m2);
    const L_natural_m = override_m > 0 ? override_m : Math.sqrt(area_m2) / 4;
    const delta_T = state.temperature_K - conv.air_temperature_K;
    const Ra = c.g_m_s2 * props.beta * Math.abs(delta_T) * Math.pow(L_natural_m, 3) / (props.nu * props.alpha);
    const Re = conv.wind_speed_m_s > 0 ? conv.wind_speed_m_s * L_forced_m / props.nu : 0;
    const n = c.convection_blend_exponent;

    return active_faces_list(state.environment.active_faces).map((orientation) => {
      const h_natural = natural_nusselt(Ra, orientation, delta_T) * props.k / L_natural_m;
      const h_forced = Re > 0 ? forced_nusselt(Re, props.Pr) * props.k / L_forced_m : 0;
      return Math.pow(Math.pow(h_natural, n) + Math.pow(h_forced, n), 1 / n);
    });
  }

  // Net air-side heat into the slab (W). Positive when the air is warmer than the slab.
  function convective_air_power_W(state) {
    const conv = state.convection;
    if (!conv || !conv.enabled) {
      return 0;
    }
    const area_m2 = state.material.area_m2;
    const delta_T = conv.air_temperature_K - state.temperature_K;
    let power_W;
    if (conv.mode === "coefficient") {
      const face_count = active_face_count(state.environment.active_faces);
      power_W = face_count * conv.h_coefficient_W_m2_K * area_m2 * delta_T;
    } else {
      let h_sum_W_m2_K = 0;
      for (const h of convective_h_per_face_W_m2_K(state)) {
        if (Number.isFinite(h)) h_sum_W_m2_K += h;
      }
      power_W = h_sum_W_m2_K * area_m2 * delta_T;
    }
    return Number.isFinite(power_W) ? power_W : 0;
  }

  // Convective conductance (sum of h*A over active faces), for the integrator stability bound.
  function convective_conductance_W_K(state) {
    const conv = state.convection;
    if (!conv || !conv.enabled) {
      return 0;
    }
    const area_m2 = state.material.area_m2;
    if (conv.mode === "coefficient") {
      return active_face_count(state.environment.active_faces) * conv.h_coefficient_W_m2_K * area_m2;
    }
    let g_W_K = 0;
    for (const h of convective_h_per_face_W_m2_K(state)) {
      if (Number.isFinite(h)) g_W_K += h * area_m2;
    }
    return g_W_K;
  }

  function mean_curve_value(curve) {
    if (!curve || curve.length === 0) {
      return 1;
    }
    let sum = 0;
    for (const point of curve) {
      sum += point.value;
    }
    return sum / curve.length;
  }

  // Linearised total conductance to all reservoirs (radiative + air), used to
  // size a stable explicit-Euler sub-step: dt < 2*C/G_eff.
  function effective_conductance_W_K(state) {
    const face_count = active_face_count(state.environment.active_faces);
    const eps_bar = mean_curve_value(state.material.emissivity_curve);
    const T = state.temperature_K;
    const g_rad_W_K = 4 * eps_bar * c.stefan_boltzmann_W_m2_K4 * state.material.area_m2 * Math.pow(T, 3) * face_count;
    return g_rad_W_K + convective_conductance_W_K(state);
  }

  function compute_powers(state) {
    const p_abs_W = absorbed_power_W(state);
    const p_air_W = convective_air_power_W(state);
    const p_rad_net_W = net_radiative_power_W(state);
    return {
      absorbed_power_W: p_abs_W,
      convective_air_power_W: p_air_W,
      emitted_power_W: p_rad_net_W,
      net_power_W: p_abs_W + p_air_W - p_rad_net_W,
      total_irradiance_W_m2: total_incident_irradiance_W_m2(state)
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
  ns.absorbed_power_W = absorbed_power_W;
  ns.emitted_spectrum_samples = emitted_spectrum_samples;
  ns.net_radiative_power_W = net_radiative_power_W;
  ns.total_incident_irradiance_W_m2 = total_incident_irradiance_W_m2;
  ns.convective_air_power_W = convective_air_power_W;
  ns.convective_conductance_W_K = convective_conductance_W_K;
  ns.effective_conductance_W_K = effective_conductance_W_K;
  ns.compute_powers = compute_powers;
  ns.advance_simulation = advance_simulation;
})(window);
