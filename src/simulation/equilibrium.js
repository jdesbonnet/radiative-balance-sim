(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  function state_at_temperature(state, temperature_K) {
    return {
      running: state.running,
      sim_time_s: state.sim_time_s,
      temperature_K,
      initial_temperature_K: state.initial_temperature_K,
      playback_rate: state.playback_rate,
      material: state.material,
      radiation: state.radiation,
      environment: state.environment,
      conduction: state.conduction,
      convection: state.convection,
      history: state.history
    };
  }

  function net_power_at_temperature_W(state, temperature_K) {
    return ns.compute_powers(state_at_temperature(state, temperature_K)).net_power_W;
  }

  function estimate_equilibrium_temperature_K(state) {
    let low_K = 1;
    let high_K = 3000;
    let low_power_W = net_power_at_temperature_W(state, low_K);
    let high_power_W = net_power_at_temperature_W(state, high_K);

    if (!Number.isFinite(low_power_W) || !Number.isFinite(high_power_W)) {
      return null;
    }

    if (Math.abs(low_power_W) < 1e-6) {
      return low_K;
    }

    let expand_count = 0;
    while (low_power_W * high_power_W > 0 && expand_count < 8) {
      if (high_power_W > 0) {
        high_K *= 1.7;
        high_power_W = net_power_at_temperature_W(state, high_K);
      } else {
        low_K = Math.max(0.01, low_K * 0.5);
        low_power_W = net_power_at_temperature_W(state, low_K);
      }
      expand_count += 1;
    }

    if (low_power_W * high_power_W > 0) {
      return null;
    }

    for (let i = 0; i < 70; i += 1) {
      const mid_K = 0.5 * (low_K + high_K);
      const mid_power_W = net_power_at_temperature_W(state, mid_K);
      if (Math.abs(mid_power_W) < 1e-5 || Math.abs(high_K - low_K) < 1e-4) {
        return mid_K;
      }

      if (low_power_W * mid_power_W <= 0) {
        high_K = mid_K;
        high_power_W = mid_power_W;
      } else {
        low_K = mid_K;
        low_power_W = mid_power_W;
      }
    }

    return 0.5 * (low_K + high_K);
  }

  ns.estimate_equilibrium_temperature_K = estimate_equilibrium_temperature_K;
})(window);
