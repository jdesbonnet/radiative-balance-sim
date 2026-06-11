(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function nice_min_max(values, include_zero) {
    const finite = values.filter(Number.isFinite);
    if (finite.length === 0) {
      return include_zero ? [0, 1] : [0, 1];
    }
    let min = Math.min.apply(null, finite);
    let max = Math.max.apply(null, finite);
    if (include_zero) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    if (min === max) {
      const pad = Math.abs(min) || 1;
      min -= pad * 0.1;
      max += pad * 0.1;
    }
    const span = max - min;
    return [min - span * 0.08, max + span * 0.08];
  }

  function draw_axes(ctx, w, h, title_x, title_y) {
    const pad = { left: 54, right: 16, top: 14, bottom: 34 };
    ctx.strokeStyle = "#cbd8cf";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    ctx.fillStyle = "#5d6b62";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText(title_y, 8, pad.top + 10);
    ctx.fillText(title_x, w - 78, h - 10);
    return pad;
  }

  function draw_line_plot(canvas, series, options) {
    const size = ns.resize_canvas(canvas);
    const ctx = size.ctx;
    const w = size.width;
    const h = size.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const all_x = [];
    const all_y = [];
    for (const item of series) {
      for (const point of item.points) {
        all_x.push(point.x);
        all_y.push(point.y);
      }
    }

    const x_range = nice_min_max(all_x, false);
    const y_range = nice_min_max(all_y, options.include_zero);
    const pad = draw_axes(ctx, w, h, options.x_label, options.y_label);
    const plot_w = w - pad.left - pad.right;
    const plot_h = h - pad.top - pad.bottom;

    function px(x) {
      return pad.left + ((x - x_range[0]) / (x_range[1] - x_range[0])) * plot_w;
    }

    function py(y) {
      return pad.top + plot_h - ((y - y_range[0]) / (y_range[1] - y_range[0])) * plot_h;
    }

    ctx.fillStyle = "#5d6b62";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText(x_range[0].toPrecision(3), pad.left, h - 14);
    ctx.fillText(x_range[1].toPrecision(3), w - pad.right - 52, h - 14);
    ctx.fillText(y_range[0].toPrecision(3), 6, h - pad.bottom);
    ctx.fillText(y_range[1].toPrecision(3), 6, pad.top + 4);

    for (const item of series) {
      if (item.points.length < 2) {
        continue;
      }
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      item.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(px(point.x), py(point.y));
        else ctx.lineTo(px(point.x), py(point.y));
      });
      ctx.stroke();
    }

    let legend_x = pad.left + 8;
    const legend_y = pad.top + 14;
    for (const item of series) {
      ctx.fillStyle = item.color;
      ctx.fillRect(legend_x, legend_y - 8, 10, 3);
      ctx.fillStyle = "#17211c";
      ctx.fillText(item.label, legend_x + 14, legend_y - 4);
      legend_x += ctx.measureText(item.label).width + 34;
    }
  }

  function draw_temperature_plot(canvas, state) {
    draw_line_plot(canvas, [
      {
        label: "T",
        color: "#0f766e",
        points: state.history.map((sample) => ({ x: sample.sim_time_s, y: sample.temperature_K }))
      },
      {
        label: "T_eq",
        color: "#b45309",
        points: state.equilibrium_temperature_K
          ? state.history.map((sample) => ({ x: sample.sim_time_s, y: state.equilibrium_temperature_K }))
          : []
      }
    ], {
      x_label: "time s",
      y_label: "K",
      include_zero: false
    });
  }

  function draw_power_plot(canvas, state) {
    draw_line_plot(canvas, [
      {
        label: "P_abs",
        color: "#f5c542",
        points: state.history.map((sample) => ({ x: sample.sim_time_s, y: sample.absorbed_power_W }))
      },
      {
        label: "P_rad_net",
        color: "#e4572e",
        points: state.history.map((sample) => ({ x: sample.sim_time_s, y: sample.emitted_power_W }))
      },
      {
        label: "P_air",
        color: "#a855f7",
        points: state.history.map((sample) => ({ x: sample.sim_time_s, y: sample.convective_air_power_W }))
      },
      {
        label: "P_net",
        color: "#0f766e",
        points: state.history.map((sample) => ({ x: sample.sim_time_s, y: sample.net_power_W }))
      }
    ], {
      x_label: "time s",
      y_label: "W",
      include_zero: true
    });
  }

  function draw_spectrum_plot(canvas, state) {
    const emitted = ns.emitted_spectrum_samples(state);
    draw_line_plot(canvas, [
      {
        label: "emitted",
        color: "#e4572e",
        points: emitted.map((point) => ({ x: point.wavelength_m, y: point.emitted_power_W_m }))
      }
    ], {
      x_label: "wavelength m",
      y_label: "W/m",
      include_zero: true
    });
  }

  function draw_curve_plot(canvas, curve, color, label) {
    draw_line_plot(canvas, [
      {
        label,
        color,
        points: (curve || []).map((point) => ({ x: point.wavelength_m, y: point.value }))
      }
    ], {
      x_label: "wavelength m",
      y_label: "value",
      include_zero: true
    });
  }

  ns.draw_temperature_plot = draw_temperature_plot;
  ns.draw_power_plot = draw_power_plot;
  ns.draw_spectrum_plot = draw_spectrum_plot;
  ns.draw_curve_plot = draw_curve_plot;
})(window);
