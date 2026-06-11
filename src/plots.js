(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};
  const uPlot = global.uPlot;

  // One chart instance per host element, created lazily and resized via ResizeObserver.
  const charts = new Map();

  function fmt_value(value) {
    if (value == null || !Number.isFinite(value)) {
      return "";
    }
    if (value === 0) {
      return "0";
    }
    const abs = Math.abs(value);
    if (abs < 1e-3 || abs >= 1e5) {
      return value.toExponential(1).replace(/\.0e/, "e").replace(/e\+?(-?)0*(\d)/, "e$1$2");
    }
    return String(Number(value.toPrecision(4)));
  }

  function linear_axis_values(u, splits) {
    return splits.map(fmt_value);
  }

  // On log axes label only the decades so minor splits do not clutter the axis.
  function decade_axis_values(u, splits) {
    return splits.map((value) => {
      if (value == null || value <= 0) {
        return "";
      }
      const exponent = Math.log10(value);
      return Math.abs(exponent - Math.round(exponent)) < 1e-9 ? fmt_value(value) : "";
    });
  }

  function axis_x(label, log_scale, compact) {
    const axis = {
      stroke: "#5d6b62",
      font: compact ? "10px ui-sans-serif, system-ui" : "11px ui-sans-serif, system-ui",
      labelFont: "11px ui-sans-serif, system-ui",
      grid: { stroke: "rgba(93, 107, 98, 0.12)", width: 1 },
      ticks: { stroke: "rgba(93, 107, 98, 0.35)", width: 1 },
      values: log_scale ? decade_axis_values : linear_axis_values
    };
    if (label) {
      axis.label = label;
    }
    if (compact) {
      axis.size = 28;
    }
    return axis;
  }

  function axis_y(label, compact) {
    const axis = axis_x(label, false, compact);
    axis.size = compact ? 34 : 56;
    return axis;
  }

  function pad_range(min, max, include_zero) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 1];
    }
    if (include_zero) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    const span = (max - min) || Math.abs(min) || 1;
    return [min - span * 0.08, max + span * 0.08];
  }

  function time_x_range(u, min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 1];
    }
    return min === max ? [min - 1, max + 1] : [min, max];
  }

  // The uPlot legend sits below the plotting area inside the host, so subtract its height.
  function host_size(host, u) {
    const width = Math.max(120, host.clientWidth || 300);
    let legend_height = 0;
    if (u) {
      const legend = u.root.querySelector(".u-legend");
      legend_height = legend ? legend.offsetHeight : 0;
    }
    const height = Math.max(70, (host.clientHeight || 200) - legend_height);
    return { width, height };
  }

  function ensure_chart(host, build_opts) {
    const existing = charts.get(host);
    if (existing) {
      return existing.u;
    }
    const opts = build_opts();
    const initial = host_size(host, null);
    opts.width = initial.width;
    opts.height = initial.height;
    const placeholder = [[]];
    for (let i = 1; i < opts.series.length; i += 1) {
      placeholder.push([]);
    }
    const u = new uPlot(opts, placeholder, host);
    u.setSize(host_size(host, u));
    let raf_id = 0;
    const observer = new ResizeObserver(() => {
      if (raf_id) {
        return;
      }
      raf_id = requestAnimationFrame(() => {
        raf_id = 0;
        u.setSize(host_size(host, u));
      });
    });
    observer.observe(host);
    charts.set(host, { u, observer });
    return u;
  }

  // Horizontal gradient that paints each wavelength with its visible colour: a rainbow across
  // 380-780 nm, fading through deep red into a faint warm tone in the infrared and fading out
  // in the ultraviolet. Stops are placed at the pixel position of each wavelength via the
  // chart's own x-scale, so the gradient stays correct on the log axis and across resizes.
  // unit_scale converts wavelength in metres to the chart's x units (1 for m, 1e9 for nm).
  function spectral_fill(visible_alpha, ir_alpha, unit_scale) {
    return function (u) {
      const bbox = u.bbox;
      if (!bbox.width) {
        return "rgba(0, 0, 0, 0)";
      }
      const gradient = u.ctx.createLinearGradient(bbox.left, 0, bbox.left + bbox.width, 0);
      let last_offset = -1;
      const add_stop = (wavelength_m, color) => {
        const px = u.valToPos(wavelength_m * unit_scale, "x", true);
        let offset = (px - bbox.left) / bbox.width;
        if (!Number.isFinite(offset)) {
          return;
        }
        offset = Math.min(1, Math.max(0, offset));
        if (offset <= last_offset) {
          offset = Math.min(1, last_offset + 1e-4);
        }
        gradient.addColorStop(offset, color);
        last_offset = offset;
      };
      add_stop(1e-8, "rgba(60, 20, 100, 0.03)");
      add_stop(3.6e-7, `rgba(90, 35, 140, ${(visible_alpha * 0.4).toFixed(3)})`);
      for (let nm = 380; nm <= 780; nm += 10) {
        const c = ns.wavelength_to_rgb(nm);
        add_stop(nm * 1e-9, `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${visible_alpha})`);
      }
      add_stop(9.0e-7, `rgba(165, 45, 25, ${Math.min(visible_alpha, ir_alpha * 1.8).toFixed(3)})`);
      add_stop(2.5e-6, `rgba(130, 70, 45, ${ir_alpha})`);
      add_stop(1e-3, `rgba(120, 80, 55, ${(ir_alpha * 0.6).toFixed(3)})`);
      return gradient;
    };
  }

  function temperature_opts() {
    return {
      scales: {
        x: { time: false, range: time_x_range },
        y: { range: (u, min, max) => pad_range(min, max, false) }
      },
      series: [
        {},
        { label: "T", stroke: "#0f766e", width: 2, points: { show: false } },
        { label: "T_eq", stroke: "#b45309", width: 2, dash: [8, 5], points: { show: false } }
      ],
      axes: [axis_x("time s", false, false), axis_y("K", false)],
      cursor: { y: false }
    };
  }

  function power_opts() {
    return {
      scales: {
        x: { time: false, range: time_x_range },
        y: { range: (u, min, max) => pad_range(min, max, true) }
      },
      series: [
        {},
        { label: "P_abs", stroke: "#f5c542", width: 2, points: { show: false } },
        { label: "P_rad_net", stroke: "#e4572e", width: 2, points: { show: false } },
        { label: "P_air", stroke: "#a855f7", width: 2, points: { show: false } },
        { label: "P_net", stroke: "#0f766e", width: 2, points: { show: false } }
      ],
      axes: [axis_x("time s", false, false), axis_y("W", false)],
      cursor: { y: false }
    };
  }

  function spectrum_opts() {
    return {
      scales: {
        x: { time: false, distr: 3, log: 10 },
        y: { range: (u, min, max) => (Number.isFinite(max) && max > 0 ? [0, max * 1.08] : [0, 1]) }
      },
      series: [
        {},
        {
          label: "emitted",
          stroke: "#e4572e",
          width: 2,
          fill: spectral_fill(0.5, 0.16, 1),
          points: { show: false }
        }
      ],
      axes: [axis_x("wavelength m", true, false), axis_y("W/m", false)],
      cursor: { y: false }
    };
  }

  function curve_opts(color, label) {
    return {
      scales: {
        x: { time: false, distr: 3, log: 10 },
        y: { range: () => [0, 1.05] }
      },
      series: [
        {},
        {
          label,
          stroke: color,
          width: 2,
          fill: spectral_fill(0.35, 0.1, 1e9),
          points: { show: false }
        }
      ],
      axes: [axis_x(null, true, true), axis_y(null, true)],
      cursor: { show: false },
      legend: { show: false }
    };
  }

  function draw_temperature_plot(host, state) {
    const u = ensure_chart(host, temperature_opts);
    const equilibrium_K = Number.isFinite(state.equilibrium_temperature_K)
      ? state.equilibrium_temperature_K
      : null;
    const xs = [];
    const temperatures = [];
    const equilibria = [];
    for (const sample of state.history) {
      xs.push(sample.sim_time_s);
      temperatures.push(sample.temperature_K);
      equilibria.push(equilibrium_K);
    }
    u.setData([xs, temperatures, equilibria]);
  }

  function draw_power_plot(host, state) {
    const u = ensure_chart(host, power_opts);
    const xs = [];
    const absorbed = [];
    const radiated = [];
    const air = [];
    const net = [];
    for (const sample of state.history) {
      xs.push(sample.sim_time_s);
      absorbed.push(sample.absorbed_power_W);
      radiated.push(sample.emitted_power_W);
      air.push(sample.convective_air_power_W);
      net.push(sample.net_power_W);
    }
    u.setData([xs, absorbed, radiated, air, net]);
  }

  function draw_spectrum_plot(host, state) {
    const u = ensure_chart(host, spectrum_opts);
    const samples = ns.emitted_spectrum_samples(state);
    const xs = samples.map((point) => point.wavelength_m);
    const ys = samples.map((point) => point.emitted_power_W_m);
    u.setData([xs, ys]);
  }

  // Mini curve plots display wavelength in nm for readability; values stay 0..1.
  function draw_curve_plot(host, curve, color, label) {
    const u = ensure_chart(host, () => curve_opts(color, label));
    const points = curve || [];
    if (points.length === 0) {
      u.setData([[500], [null]]);
      return;
    }
    u.setData([
      points.map((point) => point.wavelength_m * 1e9),
      points.map((point) => point.value)
    ]);
  }

  ns.draw_temperature_plot = draw_temperature_plot;
  ns.draw_power_plot = draw_power_plot;
  ns.draw_spectrum_plot = draw_spectrum_plot;
  ns.draw_curve_plot = draw_curve_plot;
})(window);
