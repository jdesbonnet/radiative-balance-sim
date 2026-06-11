(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function add_history_sample(state, powers) {
    state.history.push({
      sim_time_s: state.sim_time_s,
      temperature_K: state.temperature_K,
      absorbed_power_W: powers.absorbed_power_W,
      emitted_power_W: powers.emitted_power_W,
      convective_air_power_W: powers.convective_air_power_W,
      net_power_W: powers.net_power_W
    });

    const max_history = 900;
    if (state.history.length > max_history) {
      state.history.splice(0, state.history.length - max_history);
    }
  }

  function start_app() {
    const state = ns.app_state;
    const slab_canvas = document.getElementById("slab_canvas");
    const temperature_plot = document.getElementById("temperature_plot");
    const power_plot = document.getElementById("power_plot");
    const spectrum_plot = document.getElementById("spectrum_plot");

    ns.init_controls(state);

    let previous_ms = performance.now();
    let last_history_wall_ms = 0;
    let last_equilibrium_wall_ms = 0;

    function frame(now_ms) {
      const wall_dt_s = Math.min(0.1, Math.max(0, (now_ms - previous_ms) / 1000));
      previous_ms = now_ms;

      const validation = ns.validate_state(state);
      if (state.control_parse_error) {
        validation.errors.push(state.control_parse_error);
      }

      let powers = ns.compute_powers(state);

      if (state.running && validation.errors.length === 0) {
        let remaining_dt_s = wall_dt_s * state.playback_rate;
        // Size the sub-step to the linearised thermal time constant so the explicit-Euler
        // step stays stable when air convection raises the effective conductance.
        const capacity_J_K = ns.heat_capacity_J_K(state.material);
        const g_eff_W_K = ns.effective_conductance_W_K(state);
        const dt_stable_s = (capacity_J_K > 0 && g_eff_W_K > 0) ? 0.5 * capacity_J_K / g_eff_W_K : 0.25;
        const max_internal_dt_s = Math.min(0.25, dt_stable_s);
        let guard = 0;
        while (remaining_dt_s > 1e-9 && guard < 20000) {
          const step_dt_s = Math.min(max_internal_dt_s, remaining_dt_s);
          powers = ns.advance_simulation(state, step_dt_s);
          remaining_dt_s -= step_dt_s;
          guard += 1;
        }
      }

      if (state.needs_equilibrium_update || now_ms - last_equilibrium_wall_ms > 1000) {
        state.equilibrium_temperature_K = validation.errors.length === 0
          ? ns.estimate_equilibrium_temperature_K(state)
          : null;
        state.needs_equilibrium_update = false;
        last_equilibrium_wall_ms = now_ms;
      }

      powers = ns.compute_powers(state);

      if (state.history.length === 0 || now_ms - last_history_wall_ms > 100) {
        add_history_sample(state, powers);
        last_history_wall_ms = now_ms;
      }

      ns.update_readouts(state, powers, validation);
      ns.draw_visualization(slab_canvas, state, powers, now_ms / 1000);
      ns.draw_temperature_plot(temperature_plot, state);
      ns.draw_power_plot(power_plot, state);
      ns.draw_spectrum_plot(spectrum_plot, state);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start_app);
  } else {
    start_app();
  }
})(window);
