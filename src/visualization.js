(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  const WIEN_B_M_K = 2.897771955e-3;
  const CONVECTION_RGB = [168, 85, 247]; // air conduction/convection arrows and legend

  function resize_canvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  }

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${alpha})`;
  }

  function mix_rgb(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  }

  // Planck-locus color of a thermal radiator, after Tanner Helland's approximation.
  // Low temperatures fall to deep red (invisible IR shown as a dull ember), warming
  // through orange and yellow toward white as the radiator gets hotter.
  function kelvin_to_rgb(kelvin) {
    const t = Math.max(1, kelvin) / 100;
    let r;
    let g;
    let b;
    if (t <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
      b = 255;
    }
    return [
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b))
    ];
  }

  // Approximate sRGB for a single visible wavelength (Dan Bruton's mapping), used to
  // give monochromatic sources such as the 532 nm line their true perceived hue.
  function wavelength_to_rgb(nm) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (nm >= 380 && nm < 440) {
      r = -(nm - 440) / 60;
      b = 1;
    } else if (nm < 490) {
      g = (nm - 440) / 50;
      b = 1;
    } else if (nm < 510) {
      g = 1;
      b = -(nm - 510) / 20;
    } else if (nm < 580) {
      r = (nm - 510) / 70;
      g = 1;
    } else if (nm < 645) {
      r = 1;
      g = -(nm - 645) / 65;
    } else if (nm <= 780) {
      r = 1;
    } else {
      return [255, 70, 40];
    }
    let falloff = 1;
    if (nm < 420) falloff = 0.3 + 0.7 * (nm - 380) / 40;
    else if (nm > 700) falloff = 0.3 + 0.7 * (780 - nm) / 80;
    const gamma = 0.8;
    return [
      255 * Math.pow(Math.max(0, r) * falloff, gamma),
      255 * Math.pow(Math.max(0, g) * falloff, gamma),
      255 * Math.pow(Math.max(0, b) * falloff, gamma)
    ];
  }

  function peak_wavelength_m(spectrum) {
    if (!spectrum || spectrum.length === 0) {
      return 5.0e-7;
    }
    let best = spectrum[0];
    for (let i = 1; i < spectrum.length; i += 1) {
      if (spectrum[i].irradiance_W_m2_m > best.irradiance_W_m2_m) {
        best = spectrum[i];
      }
    }
    return best.wavelength_m > 0 ? best.wavelength_m : 5.0e-7;
  }

  // Map a physical wavelength to an on-screen oscillation period. Compressed onto a log
  // scale so the ~20x span between visible sunlight and room-temperature thermal IR turns
  // into a readable "short waves vs long waves" contrast rather than off-screen extremes.
  function wavelength_to_period_px(wavelength_m) {
    const um = Math.max(1e-3, wavelength_m * 1e6);
    const x = clamp01((Math.log10(um) + 1) / 2.7);
    return 12 + x * 34;
  }

  // Representative color of the illuminating source: a Planck color for broadband
  // thermal sources, or the true spectral hue for a monochromatic (narrow-band) source.
  function incident_color(state) {
    const source_temperature_K = state.radiation.source_temperature_K;
    if (source_temperature_K && source_temperature_K > 0) {
      return kelvin_to_rgb(source_temperature_K);
    }
    return wavelength_to_rgb(peak_wavelength_m(state.radiation.spectrum) * 1e9);
  }

  // Cool steel-blue when cold, warming through neutral to an ember tone as it heats.
  // This carries temperature even before the slab is hot enough to visibly glow.
  function slab_surface_color(temperature_K) {
    const t = clamp01((temperature_K - 250) / 620);
    const cool = [54, 78, 122];
    const mid = [120, 122, 126];
    const hot = [150, 68, 44];
    return t < 0.5 ? mix_rgb(cool, mid, t * 2) : mix_rgb(mid, hot, (t - 0.5) * 2);
  }

  // A transverse traveling wave drawn along a ray (ox, oy) -> direction (dx, dy).
  // The amplitude tapers at both ends and the stroke fades along the ray so beams read
  // as flowing rather than as static rigid lines.
  function draw_wave_ray(ctx, ox, oy, dx, dy, length, opts) {
    const perp_x = -dy;
    const perp_y = dx;
    const period = opts.period_px;
    const k = (Math.PI * 2) / period;
    const phase = opts.phase;
    const amp = opts.amp_px;
    const steps = Math.max(16, Math.min(72, Math.round((length / period) * 8)));

    const end_x = ox + dx * length;
    const end_y = oy + dy * length;
    const grad = ctx.createLinearGradient(ox, oy, end_x, end_y);
    grad.addColorStop(0, rgba(opts.color, opts.alpha_start));
    grad.addColorStop(1, rgba(opts.color, opts.alpha_end));

    ctx.strokeStyle = grad;
    ctx.lineWidth = opts.line_width || 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const f = i / steps;
      const s = length * f;
      const envelope = Math.sin(Math.PI * f);
      const offset = amp * (0.3 + 0.7 * envelope) * Math.sin(k * s - phase);
      const x = ox + dx * s + perp_x * offset;
      const y = oy + dy * s + perp_y * offset;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A soft glowing blob travelling along a ray, suggesting a packet of energy in transit.
  function draw_packet(ctx, ox, oy, dx, dy, length, distance, radius, color, alpha) {
    const s = ((distance % length) + length) % length;
    const fade = Math.sin(Math.PI * (s / length));
    if (fade <= 0.01) return;
    const x = ox + dx * s;
    const y = oy + dy * s;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, rgba(color, alpha * fade));
    grad.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // A row of short, straight arrows perpendicular to a face, conveying non-radiative
  // (conduction/convection) heat exchange with the air. Deliberately stubby and marching
  // rather than long and wavy, so they read as distinct from the radiation beams. Each
  // little arrow drifts along the direction of heat flow -- outward (away from the
  // surface) when the slab is shedding heat, inward when the warmer air is heating it --
  // and fades in and out along a short track so each column reads as a continuous stream.
  //   surf_y    : y of the face
  //   normal_y  : outward normal in y (-1 for the top face, +1 for the bottom)
  //   leaving   : true when heat flows out of the slab, false when it arrives
  function draw_flow_arrows(ctx, surf_y, normal_y, leaving, x_positions, t, color, peak_alpha) {
    const BASE = 7;          // gap between the surface and the nearest arrow
    const TRACK = 30;        // how far from the surface the stream reaches
    const ARROW_LEN = 13;    // length of each little arrow (shaft + head)
    const HEAD = 5;
    const MARCHERS = 2;      // arrows in flight per column at any moment
    const PERIOD_S = 1.2;
    const flow_y = leaving ? normal_y : -normal_y; // direction the arrows point and travel
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineWidth = 2;
    for (let c = 0; c < x_positions.length; c += 1) {
      const x = x_positions[c];
      for (let m = 0; m < MARCHERS; m += 1) {
        let prog = (t / PERIOD_S + c * 0.13 + m / MARCHERS) % 1;
        if (prog < 0) prog += 1;
        const fade = Math.sin(Math.PI * prog);
        if (fade <= 0.02) continue;
        // Arrows always live on the air side; they recede toward the surface when arriving.
        const dist = BASE + TRACK * (leaving ? prog : 1 - prog);
        const center_y = surf_y + normal_y * dist;
        const tip_y = center_y + flow_y * (ARROW_LEN / 2);
        const tail_y = center_y - flow_y * (ARROW_LEN / 2);
        const alpha = peak_alpha * fade;
        ctx.strokeStyle = rgba(color, alpha);
        ctx.fillStyle = rgba(color, alpha);
        ctx.beginPath();
        ctx.moveTo(x, tail_y);
        ctx.lineTo(x, tip_y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, tip_y);
        ctx.lineTo(x - HEAD * 0.6, tip_y - flow_y * HEAD);
        ctx.lineTo(x + HEAD * 0.6, tip_y - flow_y * HEAD);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function draw_background(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0c1118");
    sky.addColorStop(0.55, "#11161f");
    sky.addColorStop(1, "#0a0e14");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(120, 170, 160, 0.05)";
    ctx.lineWidth = 1;
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(w / 2, h * 0.5, h * 0.2, w / 2, h * 0.5, h * 0.9);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  function draw_visualization(canvas, state, powers, elapsed_s) {
    const size = resize_canvas(canvas);
    const ctx = size.ctx;
    const w = size.width;
    const h = size.height;

    draw_background(ctx, w, h);

    const slab_w = Math.min(w * 0.6, 500);
    const slab_h = ns.clamp(state.material.thickness_m / 0.01, 0.08, 1) * 42 + 16;
    const slab_x = (w - slab_w) / 2;
    const slab_top = h * 0.52;
    const slab_bottom = slab_top + slab_h;
    const slab_cx = slab_x + slab_w / 2;
    const ray_count = 9; // incident rays; emitted beams sit in the gaps between them

    const temperature_K = state.temperature_K;
    const glow_color = kelvin_to_rgb(temperature_K);

    // ---- Shared intensity model -------------------------------------------------------
    // Incident and emitted waves are driven by the SAME physical quantity -- radiative
    // power flux in W/m^2 -- through the SAME mapping, so equal flux reads as equal
    // on-screen intensity and the two can be compared as the slab approaches balance.
    const SIGMA = ns.constants.stefan_boltzmann_W_m2_K4;
    const REF_FLUX_W_m2 = 1000; // ~1 sun reads as full intensity
    const WAVE_ALPHA_MIN = 0.12;
    const WAVE_ALPHA_MAX = 0.82;
    const flux_intensity = (flux_W_m2) => clamp01(flux_W_m2 / REF_FLUX_W_m2);
    const flux_alpha = (flux_W_m2) =>
      WAVE_ALPHA_MIN + (WAVE_ALPHA_MAX - WAVE_ALPHA_MIN) * flux_intensity(flux_W_m2);

    // Gross thermal exitance leaving one face: emissivity at the spectral peak * sigma * T^4.
    const emit_peak_m = WIEN_B_M_K / Math.max(1, temperature_K);
    const eps_eff = clamp01(ns.interpolate_curve_value(state.material.emissivity_curve, emit_peak_m));
    const emitted_flux_W_m2 = eps_eff * SIGMA * Math.pow(temperature_K, 4);
    const emit_intensity = flux_intensity(emitted_flux_W_m2);

    // Visible incandescence (the slab glowing red-hot) only sets in well above room
    // temperature -- gated separately from the always-present IR emission waves.
    const glow_norm = clamp01((temperature_K - 600) / 800);

    // ---- Incident illumination -------------------------------------------------------
    const irradiance = powers.total_irradiance_W_m2;
    const incident_intensity = flux_intensity(irradiance);
    const in_color = incident_color(state);
    const in_period = wavelength_to_period_px(peak_wavelength_m(state.radiation.spectrum));
    // Beam tilt follows the incidence angle (measured from the surface normal). Capped
    // short of grazing so the beam never degenerates into a flat horizontal line.
    const incidence_rad = ns.clamp(state.radiation.incidence_angle_deg, 0, 80) * Math.PI / 180;
    const in_dx = Math.sin(incidence_rad);
    const in_dy = Math.cos(incidence_rad);

    if (incident_intensity > 0.01) {
      const top_band = ctx.createLinearGradient(0, 0, 0, h * 0.32);
      top_band.addColorStop(0, rgba(in_color, 0.16 * incident_intensity));
      top_band.addColorStop(1, rgba(in_color, 0));
      ctx.fillStyle = top_band;
      ctx.fillRect(0, 0, w, h * 0.32);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (incident_intensity > 0.01) {
      const beam_alpha = flux_alpha(irradiance);
      const packet_speed = 150;
      for (let i = 0; i < ray_count; i += 1) {
        const hit_x = slab_x + (slab_w * (i + 0.5)) / ray_count;
        const beam_len = (slab_top + 70) / Math.max(in_dy, 0.32);
        const start_x = hit_x - in_dx * beam_len;
        const start_y = slab_top - in_dy * beam_len;
        const phase = elapsed_s * 7 + i * 0.6;
        draw_wave_ray(ctx, start_x, start_y, in_dx, in_dy, beam_len, {
          period_px: in_period,
          amp_px: 5,
          phase: phase,
          color: in_color,
          alpha_start: beam_alpha * 0.05,
          alpha_end: beam_alpha,
          line_width: 2
        });
        const distance = elapsed_s * packet_speed + (i / ray_count) * beam_len;
        draw_packet(ctx, start_x, start_y, in_dx, in_dy, beam_len, distance, 9, in_color, beam_alpha * 0.9);
      }
    }

    // ---- Reflected (non-absorbed) radiation: a secondary cue for absorptivity ---------
    const intercepted_W = irradiance * state.material.area_m2 * Math.max(0, Math.cos(incidence_rad));
    const reflectivity = intercepted_W > 1e-9
      ? clamp01(1 - powers.absorbed_power_W / intercepted_W)
      : 0;
    if (incident_intensity > 0.01 && reflectivity > 0.02) {
      const ref_dx = in_dx;
      const ref_dy = -in_dy;
      const ref_len = (slab_top + 40) / Math.max(in_dy, 0.32) * 0.85;
      const ref_alpha = (0.12 + 0.5 * incident_intensity) * reflectivity;
      for (let i = 0; i < ray_count; i += 1) {
        const hit_x = slab_x + (slab_w * (i + 0.5)) / ray_count;
        draw_wave_ray(ctx, hit_x, slab_top, ref_dx, ref_dy, ref_len, {
          period_px: in_period,
          amp_px: 4,
          phase: -elapsed_s * 7 - i * 0.6,
          color: in_color,
          alpha_start: ref_alpha,
          alpha_end: 0,
          line_width: 1.5
        });
      }
    }
    ctx.restore();

    // ---- Slab incandescence halo ------------------------------------------------------
    if (glow_norm > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const halo_r = slab_w * (0.5 + 0.35 * glow_norm);
      const halo = ctx.createRadialGradient(slab_cx, (slab_top + slab_bottom) / 2, slab_h * 0.4, slab_cx, (slab_top + slab_bottom) / 2, halo_r);
      halo.addColorStop(0, rgba(glow_color, 0.42 * glow_norm));
      halo.addColorStop(1, rgba(glow_color, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(slab_cx - halo_r, (slab_top + slab_bottom) / 2 - halo_r, halo_r * 2, halo_r * 2);
      ctx.restore();
    }

    // ---- Slab body --------------------------------------------------------------------
    const surface = slab_surface_color(temperature_K);
    const body_color = mix_rgb(surface, glow_color, 0.85 * glow_norm);
    const body_top = mix_rgb(body_color, [255, 255, 255], 0.12);
    const body_bottom = mix_rgb(body_color, [0, 0, 0], 0.25);
    const body_grad = ctx.createLinearGradient(0, slab_top, 0, slab_bottom);
    body_grad.addColorStop(0, rgba(body_top, 1));
    body_grad.addColorStop(1, rgba(body_bottom, 1));

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = body_grad;
    ctx.fillRect(slab_x, slab_top, slab_w, slab_h);
    ctx.restore();

    ctx.strokeStyle = rgba(mix_rgb(body_top, [255, 255, 255], 0.3), 0.7);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(slab_x + 0.5, slab_top + 0.5, slab_w - 1, slab_h - 1);

    ctx.fillStyle = "rgba(245, 248, 245, 0.92)";
    ctx.font = "600 13px ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";
    ctx.fillText(`${temperature_K.toFixed(2)} K`, slab_x + 12, (slab_top + slab_bottom) / 2);
    ctx.textBaseline = "alphabetic";

    // ---- Absorption shimmer where the beam lands -------------------------------------
    const absorptivity = intercepted_W > 1e-9 ? clamp01(powers.absorbed_power_W / intercepted_W) : 0;
    if (incident_intensity > 0.01 && absorptivity > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.6 + 0.4 * Math.sin(elapsed_s * 6);
      const spot_color = mix_rgb(in_color, glow_color, 0.5);
      for (let i = 0; i < ray_count; i += 1) {
        const hit_x = slab_x + (slab_w * (i + 0.5)) / ray_count;
        const radius = 7 + 9 * absorptivity * incident_intensity;
        const spot = ctx.createRadialGradient(hit_x, slab_top, 0, hit_x, slab_top, radius);
        spot.addColorStop(0, rgba(spot_color, 0.5 * absorptivity * incident_intensity * pulse));
        spot.addColorStop(1, rgba(spot_color, 0));
        ctx.fillStyle = spot;
        ctx.beginPath();
        ctx.arc(hit_x, slab_top, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ---- Emitted thermal radiation -----------------------------------------------------
    // Drawn in the same collimated style as the incident beam, but leaving the surface,
    // colored by the slab's Planck temperature (red/ember) and at a visibly longer
    // wavelength (broader waves). The beams slot into the gaps between the incident rays.
    const draw_top = state.environment.active_faces === "top" || state.environment.active_faces === "both";
    const draw_bottom = state.environment.active_faces === "bottom" || state.environment.active_faces === "both";
    const emit_period = wavelength_to_period_px(emit_peak_m) * 1.2;
    const emit_amp = 5 + 2 * emit_intensity;
    const emit_alpha = flux_alpha(emitted_flux_W_m2);

    function draw_emission(origin_y, dir_y, max_len) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Reach grows strongly with temperature: short stubs when cool, long beams when hot.
      const len = ns.clamp(60 + (max_len - 60) * emit_intensity, 50, Math.max(50, max_len));
      for (let j = 1; j < ray_count; j += 1) {
        const x = slab_x + (slab_w * j) / ray_count;
        draw_wave_ray(ctx, x, origin_y, 0, dir_y, len, {
          period_px: emit_period,
          amp_px: emit_amp,
          phase: elapsed_s * 5 + j * 0.7,
          color: glow_color,
          alpha_start: emit_alpha,
          alpha_end: emit_alpha * 0.04,
          line_width: 2
        });
        if (emit_intensity > 0.1) {
          const distance = elapsed_s * 120 + (j / ray_count) * len;
          draw_packet(ctx, x, origin_y, 0, dir_y, len, distance, 8, glow_color, emit_alpha * 0.9);
        }
      }
      ctx.restore();
    }

    if (draw_top) draw_emission(slab_top, -1, slab_top - 16);
    if (draw_bottom) draw_emission(slab_bottom, 1, h - slab_bottom - 16);

    // ---- Air convection (lumped conduction + convection to the surrounding air) -------
    // Short straight arrows spaced like the radiation rays (slotted into the incident
    // comb, between the emitted beams) and marching along the direction of heat flow.
    const convection_active = state.convection.enabled && Math.abs(powers.convective_air_power_W) > 1e-9;
    const convection_leaving = powers.convective_air_power_W < 0; // slab warmer than air -> shedding heat
    if (convection_active) {
      const conv_face_count = state.environment.active_faces === "both" ? 2 : 1;
      const conv_flux = state.material.area_m2 > 0
        ? Math.abs(powers.convective_air_power_W) / (state.material.area_m2 * conv_face_count)
        : 0;
      const conv_alpha = 0.3 + 0.5 * flux_intensity(conv_flux);
      const conv_xs = [];
      for (let i = 0; i < ray_count; i += 1) {
        conv_xs.push(slab_x + (slab_w * (i + 0.5)) / ray_count);
      }
      if (draw_top) draw_flow_arrows(ctx, slab_top, -1, convection_leaving, conv_xs, elapsed_s, CONVECTION_RGB, conv_alpha);
      if (draw_bottom) draw_flow_arrows(ctx, slab_bottom, 1, convection_leaving, conv_xs, elapsed_s, CONVECTION_RGB, conv_alpha);
    }

    // ---- Labels & legend --------------------------------------------------------------
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(226, 232, 226, 0.78)";
    ctx.fillText("Incident illumination", 18, 26);
    ctx.fillStyle = rgba(in_color, 0.95);
    ctx.fillRect(18, 34, 26, 4);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(226, 232, 226, 0.78)";
    ctx.fillText("Reflected illumination", w - 18, 26);
    ctx.fillStyle = rgba(in_color, 0.65);
    ctx.fillRect(w - 44, 34, 26, 4);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(226, 232, 226, 0.78)";
    ctx.fillText("Emitted thermal radiation", 18, h - 26);
    ctx.fillStyle = rgba(glow_color, 0.95);
    ctx.fillRect(18, h - 20, 26, 4);

    // Bottom-right: only present while air-side exchange is active. The swatch is a small
    // straight arrow echoing the animated convection arrows -- up when the slab sheds heat
    // to the air, down when the warmer air is heating the slab.
    if (convection_active) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(226, 232, 226, 0.78)";
      ctx.fillText(convection_leaving ? "Air convection (heat out)" : "Air convection (heat in)", w - 18, h - 26);
      ctx.textAlign = "left";

      const cx = w - 31;
      const tip_y = convection_leaving ? h - 22 : h - 8;
      const tail_y = convection_leaving ? h - 8 : h - 22;
      const head_back = convection_leaving ? 5 : -5;
      ctx.strokeStyle = rgba(CONVECTION_RGB, 0.95);
      ctx.fillStyle = rgba(CONVECTION_RGB, 0.95);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, tail_y);
      ctx.lineTo(cx, tip_y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, tip_y);
      ctx.lineTo(cx - 4, tip_y + head_back);
      ctx.lineTo(cx + 4, tip_y + head_back);
      ctx.closePath();
      ctx.fill();
    }
  }

  ns.resize_canvas = resize_canvas;
  ns.wavelength_to_rgb = wavelength_to_rgb;
  ns.draw_visualization = draw_visualization;
})(window);
