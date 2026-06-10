(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};
  const c = ns.constants;

  function blackbody_exitance_W_m3(wavelength_m, temperature_K) {
    if (wavelength_m <= 0 || temperature_K <= 0) {
      return 0;
    }

    const exponent = (c.planck_constant_J_s * c.speed_of_light_m_s) /
      (wavelength_m * c.boltzmann_constant_J_K * temperature_K);

    if (exponent > 700) {
      return 0;
    }

    const numerator = 2 * c.pi * c.planck_constant_J_s * c.speed_of_light_m_s * c.speed_of_light_m_s;
    const denominator = Math.pow(wavelength_m, 5) * Math.expm1(exponent);
    return numerator / denominator;
  }

  function generate_wavelength_grid_m(min_wavelength_m, max_wavelength_m, count, use_log_spacing) {
    const samples = [];
    const safe_count = Math.max(2, Math.floor(count));

    if (use_log_spacing) {
      const min_log = Math.log(min_wavelength_m);
      const max_log = Math.log(max_wavelength_m);
      for (let i = 0; i < safe_count; i += 1) {
        const t = i / (safe_count - 1);
        samples.push(Math.exp(min_log + (max_log - min_log) * t));
      }
      return samples;
    }

    for (let i = 0; i < safe_count; i += 1) {
      const t = i / (safe_count - 1);
      samples.push(min_wavelength_m + (max_wavelength_m - min_wavelength_m) * t);
    }

    return samples;
  }

  ns.blackbody_exitance_W_m3 = blackbody_exitance_W_m3;
  ns.generate_wavelength_grid_m = generate_wavelength_grid_m;
})(window);
