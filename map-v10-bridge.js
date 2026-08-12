(() => {
  'use strict';

  let pending = null;

  function target(raw) {
    const engine = window.StormLensMapV10;
    if (!engine) return null;
    if (raw === 'storms') return engine.tomorrowEnabled && engine.defs.thunderstorms ? 'thunderstorms' : 'thunderRisk';
    if (raw === 'lightning') return engine.tomorrowEnabled && engine.defs.lightningForecast ? 'lightningForecast' : 'lightning';
    if (raw === 'radar') return 'radar';
    if (raw === 'nowcast') return 'nowcast';
    if (raw === 'alerts') return 'alerts';
    return engine.defs[raw] ? raw : null;
  }

  function flush() {
    const engine = window.StormLensMapV10;
    if (!engine?.map || !pending) return;
    const id = target(pending);
    pending = null;
    if (id) engine.selectLayer(id);
  }

  document.addEventListener('stormlens:map-select-layer', event => {
    pending = event.detail?.id || null;
    flush();
  });
  window.addEventListener('stormlens:map-ready', () => setTimeout(flush, 0));
})();
