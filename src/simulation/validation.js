(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function validate_curve(curve, label, errors) {
    if (!curve || curve.length < 2) {
      errors.push(`${label} needs at least two points.`);
      return;
    }

    let previous_wavelength_m = -Infinity;
    for (const point of curve) {
      if (!Number.isFinite(point.wavelength_m) || point.wavelength_m <= 0) {
        errors.push(`${label} has a non-positive wavelength.`);
      }
      if (!Number.isFinite(point.value) || point.value < 0 || point.value > 1) {
        errors.push(`${label} values must be between 0 and 1.`);
      }
      if (point.wavelength_m <= previous_wavelength_m) {
        errors.push(`${label} wavelengths must be strictly increasing.`);
      }
      previous_wavelength_m = point.wavelength_m;
    }
  }

  function validate_spectrum(spectrum, errors) {
    if (!spectrum || spectrum.length < 2) {
      errors.push("Radiation spectrum needs at least two points.");
      return;
    }

    let previous_wavelength_m = -Infinity;
    for (const point of spectrum) {
      if (!Number.isFinite(point.wavelength_m) || point.wavelength_m <= 0) {
        errors.push("Spectrum has a non-positive wavelength.");
      }
      if (!Number.isFinite(point.irradiance_W_m2_m) || point.irradiance_W_m2_m < 0) {
        errors.push("Spectrum irradiance values must be non-negative.");
      }
      if (point.wavelength_m <= previous_wavelength_m) {
        errors.push("Spectrum wavelengths must be strictly increasing.");
      }
      previous_wavelength_m = point.wavelength_m;
    }
  }

  function validate_state(state) {
    const errors = [];
    const warnings = [];
    const m = state.material;
    const r = state.radiation;
    const e = state.environment;
    const c = state.conduction;

    if (!(m.density_kg_m3 > 0)) errors.push("Density must be positive.");
    if (!(m.specific_heat_J_kg_K > 0)) errors.push("Specific heat must be positive.");
    if (!(m.thickness_m > 0)) errors.push("Thickness must be positive.");
    if (!(m.area_m2 > 0)) errors.push("Area must be positive.");
    if (!(m.thermal_conductivity_W_m_K >= 0)) errors.push("Thermal conductivity must be non-negative.");
    if (!(state.temperature_K > 0)) errors.push("Temperature must be greater than 0 K.");
    if (!(state.initial_temperature_K > 0)) errors.push("Initial temperature must be greater than 0 K.");
    if (!(e.temperature_K > 0)) errors.push("Environment temperature must be greater than 0 K.");
    if (!(r.irradiance_scale >= 0)) errors.push("Irradiance scale must be non-negative.");
    if (!(r.incidence_angle_deg >= 0 && r.incidence_angle_deg <= 90)) errors.push("Incidence angle must be 0 to 90 degrees.");

    if (c.enabled) {
      if (!(c.boundary_temperature_K > 0)) errors.push("Boundary temperature must be greater than 0 K.");
      if (c.mode === "direct" && !(c.conductance_W_K >= 0)) errors.push("Conductance must be non-negative.");
      if (c.mode === "geometry") {
        if (!(c.contact_area_m2 > 0)) errors.push("Contact area must be positive.");
        if (!(c.path_length_m > 0)) errors.push("Path length must be positive.");
        if (!(c.conductor_thermal_conductivity_W_m_K > 0)) errors.push("Conductor thermal conductivity must be positive.");
      }
    }

    const v = state.convection;
    if (v && v.enabled) {
      if (!(v.air_temperature_K > 0 && v.air_temperature_K <= 3000)) errors.push("Air temperature must be between 0 and 3000 K.");
      if (v.mode === "coefficient") {
        if (!(v.h_coefficient_W_m2_K >= 0)) errors.push("Convection coefficient must be non-negative.");
      } else {
        if (!(v.wind_speed_m_s >= 0)) errors.push("Wind speed must be non-negative.");
        if (!(v.characteristic_length_m >= 0)) errors.push("Characteristic length must be non-negative (0 = auto).");
        if (!(v.air_thermal_conductivity_ref_W_m_K > 0)) errors.push("Air thermal conductivity must be positive.");
        if (!(v.air_kinematic_viscosity_ref_m2_s > 0)) errors.push("Air kinematic viscosity must be positive.");
        if (!(v.air_thermal_diffusivity_ref_m2_s > 0)) errors.push("Air thermal diffusivity must be positive.");
        if (!(v.air_prandtl_number > 0)) errors.push("Air Prandtl number must be positive.");
        if (!(v.pressure_scale > 0)) errors.push("Pressure scale must be positive.");
      }
    }

    validate_curve(m.absorptivity_curve, "Absorptivity curve", errors);
    validate_curve(m.emissivity_curve, "Emissivity curve", errors);
    validate_spectrum(r.spectrum, errors);

    if (state.temperature_K < 100) {
      warnings.push("Temperature is below 100 K; preset assumptions may be weak.");
    }
    if (state.temperature_K > 1000) {
      warnings.push("Temperature is above 1000 K; coatings and material limits may dominate.");
    }
    if (v && v.enabled && v.mode === "coefficient" && v.h_coefficient_W_m2_K > 200) {
      warnings.push("Convection coefficient above 200 W/(m^2 K) is storm-wind regime; results may be unreliable.");
    }
    if (m.thickness_m < 1e-4) {
      warnings.push("Thickness below 0.1 mm; thin films stress the integrator at high convection or temperature.");
    }

    return { errors, warnings };
  }

  ns.validate_state = validate_state;
})(window);
