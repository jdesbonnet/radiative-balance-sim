(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function gaussian(x, center, width) {
    const z = (x - center) / width;
    return Math.exp(-0.5 * z * z);
  }

  function normalize_spectrum(samples, total_irradiance_W_m2) {
    const raw_total = ns.integrate_spectrum_irradiance_W_m2(samples, 1);
    const scale = raw_total > 0 ? total_irradiance_W_m2 / raw_total : 0;
    return samples.map((point) => ({
      wavelength_m: point.wavelength_m,
      irradiance_W_m2_m: point.irradiance_W_m2_m * scale
    }));
  }

  function make_blackbody_irradiance_spectrum(temperature_K, total_irradiance_W_m2, min_wavelength_m, max_wavelength_m, count, modifier_fn) {
    const wavelengths = ns.generate_wavelength_grid_m(min_wavelength_m, max_wavelength_m, count, false);
    const raw = wavelengths.map((wavelength_m) => {
      const modifier = modifier_fn ? modifier_fn(wavelength_m) : 1;
      return {
        wavelength_m,
        irradiance_W_m2_m: Math.max(0, ns.blackbody_exitance_W_m3(wavelength_m, temperature_K) * modifier)
      };
    });
    return normalize_spectrum(raw, total_irradiance_W_m2);
  }

  function am15_modifier(wavelength_m) {
    const wavelength_um = wavelength_m * 1e6;
    let transmission = 0.74;
    transmission *= 1 - 0.18 * gaussian(wavelength_um, 0.76, 0.035);
    transmission *= 1 - 0.28 * gaussian(wavelength_um, 0.94, 0.08);
    transmission *= 1 - 0.40 * gaussian(wavelength_um, 1.38, 0.08);
    transmission *= 1 - 0.35 * gaussian(wavelength_um, 1.88, 0.11);
    transmission *= 1 - 0.55 * gaussian(wavelength_um, 2.65, 0.25);
    if (wavelength_um < 0.32) {
      transmission *= Math.max(0, (wavelength_um - 0.28) / 0.04);
    }
    return ns.clamp(transmission, 0, 1);
  }

  function make_laser_like_spectrum(center_wavelength_m, total_irradiance_W_m2) {
    const min_wavelength_m = Math.max(1e-9, center_wavelength_m * 0.5);
    const max_wavelength_m = center_wavelength_m * 1.5;
    const wavelengths = ns.generate_wavelength_grid_m(min_wavelength_m, max_wavelength_m, 121, false);
    const width_m = center_wavelength_m * 0.035;
    const raw = wavelengths.map((wavelength_m) => ({
      wavelength_m,
      irradiance_W_m2_m: gaussian(wavelength_m, center_wavelength_m, width_m)
    }));
    return normalize_spectrum(raw, total_irradiance_W_m2);
  }

  function create_spectrum_presets() {
    return [
      {
        id: "solar_am15_compact",
        label: "Solar surface compact AM1.5-like",
        total_irradiance_W_m2: 1000,
        source_temperature_K: 5778,
        allows_temperature: false,
        create_spectrum: function () {
          return make_blackbody_irradiance_spectrum(5778, 1000, 2.8e-7, 4.0e-6, 220, am15_modifier);
        }
      },
      {
        id: "solar_am0_compact",
        label: "Solar orbit compact AM0-like",
        total_irradiance_W_m2: 1361,
        source_temperature_K: 5778,
        allows_temperature: false,
        create_spectrum: function () {
          return make_blackbody_irradiance_spectrum(5778, 1361, 2.0e-7, 4.0e-6, 220, null);
        }
      },
      {
        id: "blackbody_source",
        label: "Blackbody source",
        total_irradiance_W_m2: 1000,
        source_temperature_K: 1200,
        allows_temperature: true,
        create_spectrum: function (source_temperature_K) {
          return make_blackbody_irradiance_spectrum(source_temperature_K || 1200, 1000, 2.0e-7, 2.0e-5, 260, null);
        }
      },
      {
        id: "infrared_heater",
        label: "Infrared heater compact",
        total_irradiance_W_m2: 800,
        source_temperature_K: 900,
        allows_temperature: true,
        create_spectrum: function (source_temperature_K) {
          return make_blackbody_irradiance_spectrum(source_temperature_K || 900, 800, 1.0e-6, 3.0e-5, 220, null);
        }
      },
      {
        id: "narrowband_green",
        label: "Narrow-band 532 nm",
        total_irradiance_W_m2: 100,
        source_temperature_K: 0,
        allows_temperature: false,
        create_spectrum: function () {
          return make_laser_like_spectrum(5.32e-7, 100);
        }
      }
    ];
  }

  function clone_spectrum(samples) {
    return (samples || []).map((point) => ({
      wavelength_m: Number(point.wavelength_m),
      irradiance_W_m2_m: Number(point.irradiance_W_m2_m)
    }));
  }

  ns.create_spectrum_presets = create_spectrum_presets;
  ns.clone_spectrum = clone_spectrum;
})(window);
