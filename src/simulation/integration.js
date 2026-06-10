(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function integrate_samples(samples, value_fn) {
    if (!samples || samples.length < 2) {
      return 0;
    }

    let total = 0;
    for (let i = 0; i < samples.length - 1; i += 1) {
      const left = samples[i];
      const right = samples[i + 1];
      const dx = right.wavelength_m - left.wavelength_m;
      if (dx <= 0) {
        continue;
      }
      total += 0.5 * dx * (value_fn(left) + value_fn(right));
    }
    return total;
  }

  function integrate_spectrum_irradiance_W_m2(spectrum, irradiance_scale) {
    const scale = Number.isFinite(irradiance_scale) ? irradiance_scale : 1;
    return integrate_samples(spectrum, (point) => point.irradiance_W_m2_m * scale);
  }

  function integrate_spectrum_with_curve_W_m2(spectrum, curve, irradiance_scale) {
    const scale = Number.isFinite(irradiance_scale) ? irradiance_scale : 1;
    return integrate_samples(spectrum, (point) => {
      const optical_value = ns.interpolate_curve_value(curve, point.wavelength_m);
      return point.irradiance_W_m2_m * scale * optical_value;
    });
  }

  ns.integrate_samples = integrate_samples;
  ns.integrate_spectrum_irradiance_W_m2 = integrate_spectrum_irradiance_W_m2;
  ns.integrate_spectrum_with_curve_W_m2 = integrate_spectrum_with_curve_W_m2;
})(window);
