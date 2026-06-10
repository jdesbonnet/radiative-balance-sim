(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function clone_curve(curve) {
    return (curve || []).map((point) => ({
      wavelength_m: Number(point.wavelength_m),
      value: Number(point.value)
    }));
  }

  function sort_curve(curve) {
    return clone_curve(curve).sort((a, b) => a.wavelength_m - b.wavelength_m);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function interpolate_curve_value(curve, wavelength_m) {
    const sorted = sort_curve(curve);
    if (sorted.length === 0) {
      return 0;
    }
    if (wavelength_m <= sorted[0].wavelength_m) {
      return sorted[0].value;
    }
    if (wavelength_m >= sorted[sorted.length - 1].wavelength_m) {
      return sorted[sorted.length - 1].value;
    }

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const left = sorted[i];
      const right = sorted[i + 1];
      if (wavelength_m >= left.wavelength_m && wavelength_m <= right.wavelength_m) {
        const span = right.wavelength_m - left.wavelength_m;
        const t = span === 0 ? 0 : (wavelength_m - left.wavelength_m) / span;
        return left.value + (right.value - left.value) * t;
      }
    }

    return sorted[sorted.length - 1].value;
  }

  function curve_to_text(curve) {
    return sort_curve(curve)
      .map((point) => `${point.wavelength_m.toExponential(6)},${Number(point.value).toFixed(4)}`)
      .join("\n");
  }

  function parse_curve_text(text) {
    const points = [];
    const lines = String(text || "").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const parts = trimmed.split(/[,\s]+/).filter(Boolean);
      if (parts.length < 2) {
        throw new Error(`Could not parse curve line: ${line}`);
      }

      const wavelength_m = Number(parts[0]);
      const value = Number(parts[1]);
      if (!Number.isFinite(wavelength_m) || !Number.isFinite(value)) {
        throw new Error(`Curve line has non-numeric values: ${line}`);
      }

      points.push({ wavelength_m, value });
    }

    return sort_curve(points);
  }

  ns.clone_curve = clone_curve;
  ns.sort_curve = sort_curve;
  ns.clamp = clamp;
  ns.interpolate_curve_value = interpolate_curve_value;
  ns.curve_to_text = curve_to_text;
  ns.parse_curve_text = parse_curve_text;
})(window);
