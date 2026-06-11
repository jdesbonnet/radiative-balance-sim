(function (global) {
  "use strict";

  const ns = global.EmissivitySim = global.EmissivitySim || {};

  ns.constants = {
    planck_constant_J_s: 6.62607015e-34,
    speed_of_light_m_s: 299792458,
    boltzmann_constant_J_K: 1.380649e-23,
    stefan_boltzmann_W_m2_K4: 5.670374419e-8,
    pi: Math.PI,
    g_m_s2: 9.80665,
    convection_blend_exponent: 3,
    convection_transition_reynolds: 5e5,
    air_film_reference_temperature_K: 300
  };
})(window);
