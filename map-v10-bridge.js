(() => {
  'use strict';

  let pending = null;
  let locationFingerprint = '';

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

  function currentLocationFingerprint() {
    try {
      const loc = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      if (!loc) return '';
      return `${Number(loc.latitude).toFixed(5)},${Number(loc.longitude).toFixed(5)}`;
    } catch (_) { return ''; }
  }

  function syncLocation() {
    const fingerprint = currentLocationFingerprint();
    if (!fingerprint || fingerprint === locationFingerprint) return;
    const engine = window.StormLensMapV10;
    locationFingerprint = fingerprint;
    if (engine?.map) engine.recenter();
  }

  document.addEventListener('stormlens:map-select-layer', event => {
    pending = event.detail?.id || null;
    flush();
  });
  window.addEventListener('stormlens:map-ready', () => {
    locationFingerprint = currentLocationFingerprint();
    setTimeout(flush, 0);
  });
  setInterval(syncLocation, 1500);
})();
