(() => {
  if (!window.L) return;

  // GeoMet advertises second-precision ISO8601 values such as
  // 2026-08-12T00:54:00Z. JavaScript Date#toISOString adds .000Z.
  // Normalize WMS TIME values to the exact precision published by GeoMet.
  const Wms = L.TileLayer?.WMS;
  if (Wms?.prototype?.setParams && !Wms.prototype._stormlensTimePatched) {
    const originalSetParams = Wms.prototype.setParams;
    Wms.prototype.setParams = function(params = {}, noRedraw) {
      const clean = { ...params };
      for (const key of ['time', 'TIME']) {
        if (typeof clean[key] === 'string') {
          clean[key] = clean[key].replace(/\.\d{3}Z$/i, 'Z');
        }
      }
      return originalSetParams.call(this, clean, noRedraw);
    };
    Wms.prototype._stormlensTimePatched = true;
  }

  function preparePremiumDefinitions() {
    const premium = window.StormLensPremiumOverlays;
    if (!premium?.defs) return false;
    // Use the documented CLDN legend/style instead of depending on a server default.
    if (premium.defs.lightning) premium.defs.lightning.style = 'Lightning';
    return true;
  }

  let prepAttempts = 0;
  const prepTimer = setInterval(() => {
    prepAttempts += 1;
    if (preparePremiumDefinitions() || prepAttempts > 40) clearInterval(prepTimer);
  }, 50);

  function reclaimTimeline() {
    const range = document.getElementById('radarTimeline');
    if (!range || !window.StormLensPremiumOverlays) return;

    // Premium master timeline is 3h observed history + nowcast/forecast to +48h.
    // The legacy single-layer engine can finish an async capabilities request later
    // and shrink this control back to a ~30-frame radar-only slider. If that happens,
    // immediately hand it back to the premium controller at NOW.
    if (Number(range.max) < 60) {
      range.min = '0';
      range.max = '81';
      range.step = '1';
      range.value = '30';
      range.dispatchEvent(new Event('input', { bubbles:true }));
    }
  }

  function installTimelineGuard() {
    [350, 900, 1800, 3500, 6500].forEach(delay => setTimeout(reclaimTimeline, delay));
  }

  window.addEventListener('stormlens:map-ready', installTimelineGuard);
  if (window.StormLensMap) installTimelineGuard();
})();
