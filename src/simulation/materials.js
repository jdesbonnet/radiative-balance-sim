(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  const curve_wavelengths_m = [
    2.0e-7,
    3.0e-7,
    5.5e-7,
    1.0e-6,
    2.5e-6,
    5.0e-6,
    1.0e-5,
    2.0e-5,
    5.0e-5
  ];

  function make_curve(values) {
    return curve_wavelengths_m.map((wavelength_m, index) => ({
      wavelength_m,
      value: values[index]
    }));
  }

  const material_presets = [
    {
      id: "polished_aluminium",
      label: "Polished aluminium",
      density_kg_m3: 2700,
      specific_heat_J_kg_K: 900,
      thermal_conductivity_W_m_K: 205,
      thickness_m: 0.002,
      area_m2: 1,
      absorptivity_curve: make_curve([0.14, 0.12, 0.09, 0.08, 0.06, 0.05, 0.04, 0.04, 0.04]),
      emissivity_curve: make_curve([0.14, 0.12, 0.09, 0.08, 0.06, 0.05, 0.04, 0.04, 0.04]),
      notes: "Plausible values for a clean polished surface."
    },
    {
      id: "anodized_aluminium",
      label: "Anodized aluminium",
      density_kg_m3: 2700,
      specific_heat_J_kg_K: 900,
      thermal_conductivity_W_m_K: 160,
      thickness_m: 0.002,
      area_m2: 1,
      absorptivity_curve: make_curve([0.78, 0.82, 0.84, 0.82, 0.80, 0.78, 0.76, 0.76, 0.75]),
      emissivity_curve: make_curve([0.78, 0.82, 0.84, 0.82, 0.80, 0.78, 0.76, 0.76, 0.75]),
      notes: "Representative dark anodized finish."
    },
    {
      id: "matte_black_paint",
      label: "Matte black paint",
      density_kg_m3: 1200,
      specific_heat_J_kg_K: 1400,
      thermal_conductivity_W_m_K: 0.25,
      thickness_m: 0.001,
      area_m2: 1,
      absorptivity_curve: make_curve([0.96, 0.97, 0.97, 0.96, 0.95, 0.95, 0.94, 0.94, 0.94]),
      emissivity_curve: make_curve([0.96, 0.97, 0.97, 0.96, 0.95, 0.95, 0.94, 0.94, 0.94]),
      notes: "High absorptivity and high emissivity coating."
    },
    {
      id: "white_paint",
      label: "White paint",
      density_kg_m3: 1300,
      specific_heat_J_kg_K: 1500,
      thermal_conductivity_W_m_K: 0.25,
      thickness_m: 0.001,
      area_m2: 1,
      absorptivity_curve: make_curve([0.20, 0.18, 0.16, 0.22, 0.42, 0.72, 0.88, 0.90, 0.90]),
      emissivity_curve: make_curve([0.20, 0.18, 0.16, 0.22, 0.42, 0.72, 0.88, 0.90, 0.90]),
      notes: "Low visible absorption with high thermal infrared emissivity."
    },
    {
      id: "stainless_steel",
      label: "Stainless steel",
      density_kg_m3: 8000,
      specific_heat_J_kg_K: 500,
      thermal_conductivity_W_m_K: 16,
      thickness_m: 0.002,
      area_m2: 1,
      absorptivity_curve: make_curve([0.45, 0.42, 0.36, 0.32, 0.27, 0.24, 0.22, 0.22, 0.22]),
      emissivity_curve: make_curve([0.45, 0.42, 0.36, 0.32, 0.27, 0.24, 0.22, 0.22, 0.22]),
      notes: "Plausible clean metallic surface."
    },
    {
      id: "polished_copper",
      label: "Polished copper",
      density_kg_m3: 8960,
      specific_heat_J_kg_K: 385,
      thermal_conductivity_W_m_K: 401,
      thickness_m: 0.002,
      area_m2: 1,
      absorptivity_curve: make_curve([0.35, 0.30, 0.23, 0.12, 0.06, 0.04, 0.035, 0.035, 0.035]),
      emissivity_curve: make_curve([0.35, 0.30, 0.23, 0.12, 0.06, 0.04, 0.035, 0.035, 0.035]),
      notes: "Plausible polished copper surface."
    },
    {
      id: "generic_ceramic",
      label: "Generic ceramic",
      density_kg_m3: 2400,
      specific_heat_J_kg_K: 850,
      thermal_conductivity_W_m_K: 2.5,
      thickness_m: 0.004,
      area_m2: 1,
      absorptivity_curve: make_curve([0.62, 0.65, 0.68, 0.72, 0.80, 0.86, 0.88, 0.88, 0.88]),
      emissivity_curve: make_curve([0.62, 0.65, 0.68, 0.72, 0.80, 0.86, 0.88, 0.88, 0.88]),
      notes: "Moderately absorptive, high-emissivity ceramic."
    },
    {
      id: "custom",
      label: "Custom material",
      density_kg_m3: 2500,
      specific_heat_J_kg_K: 1000,
      thermal_conductivity_W_m_K: 10,
      thickness_m: 0.002,
      area_m2: 1,
      absorptivity_curve: make_curve([0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50]),
      emissivity_curve: make_curve([0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50]),
      notes: "Editable baseline material."
    }
  ];

  function clone_material_preset(preset) {
    return {
      preset_id: preset.id,
      density_kg_m3: preset.density_kg_m3,
      specific_heat_J_kg_K: preset.specific_heat_J_kg_K,
      thermal_conductivity_W_m_K: preset.thermal_conductivity_W_m_K,
      thickness_m: preset.thickness_m,
      area_m2: preset.area_m2,
      absorptivity_curve: ns.clone_curve(preset.absorptivity_curve),
      emissivity_curve: ns.clone_curve(preset.emissivity_curve)
    };
  }

  ns.material_presets = material_presets;
  ns.clone_material_preset = clone_material_preset;
})(window);
