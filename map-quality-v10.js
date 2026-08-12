(() => {
  'use strict';

  const entitlements = window.StormLensTomorrowEntitlements = window.StormLensTomorrowEntitlements || {
    lightningFlashRateDensity: null,
    thunderstormProbability: null
  };

  let lightningProbePromise = null;

  function makeRadarRamp() {
    if (!window.maptilerweather?.ColorRamp) return null;
    try {
      return new maptilerweather.ColorRamp({
        stops: [
          { value: 0,  color: [0, 0, 0, 0] },
          { value: 7,  color: [0, 0, 0, 0] },
          { value: 10, color: [105, 196, 255, 105] },
          { value: 15, color: [54, 181, 235, 155] },
          { value: 20, color: [38, 205, 95, 195] },
          { value: 30, color: [23, 166, 74, 215] },
          { value: 35, color: [246, 216, 54, 225] },
          { value: 40, color: [255, 161, 38, 230] },
          { value: 45, color: [255, 92, 37, 235] },
          { value: 50, color: [238, 52, 66, 240] },
          { value: 55, color: [205, 36, 89, 242] },
          { value: 60, color: [190, 48, 207, 245] },
          { value: 65, color: [130, 43, 181, 248] },
          { value: 70, color: [235, 237, 255, 250] },
          { value: 75, color: [255, 255, 255, 255] }
        ]
      });
    } catch (error) {
      console.warn('[StormLens quality] custom radar ramp unavailable', error);
      return null;
    }
  }

  function installRadarPalette() {
    const weather = window.maptilerweather;
    if (!weather?.RadarLayer || weather.RadarLayer.__stormlensClassicRadar) return;
    const OriginalRadarLayer = weather.RadarLayer;
    const ramp = makeRadarRamp();
    if (!ramp) return;

    try {
      class StormLensRadarLayer extends OriginalRadarLayer {
        constructor(options = {}) {
          super({ ...options, colorramp: ramp, smooth: true });
        }
      }
      StormLensRadarLayer.__stormlensClassicRadar = true;
      weather.RadarLayer = StormLensRadarLayer;
    } catch (error) {
      console.warn('[StormLens quality] could not install radar palette', error);
    }
  }

  async function probe(field) {
    try {
      const response = await fetch(`/api/tomorrow-probe?field=${encodeURIComponent(field)}`, { cache: 'no-store' });
      const data = response.ok ? await response.json() : { available: false };
      entitlements[field] = Boolean(data.available);
      return data;
    } catch (_) {
      entitlements[field] = false;
      return { available: false, reason: 'probe_failed' };
    }
  }

  function ensureLightningProbe() {
    if (entitlements.lightningFlashRateDensity !== null) {
      return Promise.resolve({ available: entitlements.lightningFlashRateDensity });
    }
    if (!lightningProbePromise) lightningProbePromise = probe('lightningFlashRateDensity');
    return lightningProbePromise;
  }

  function updateLightningRows() {
    const row = document.querySelector('[data-v10-weather="lightningForecast"]');
    if (!row || entitlements.lightningFlashRateDensity === null) return;

    if (!entitlements.lightningFlashRateDensity) {
      row.classList.add('v10-plan-locked');
      row.setAttribute('aria-disabled', 'true');
      const meta = row.querySelector('.v10-layer-meta');
      if (meta) meta.textContent = 'REQUIRES LIGHTNING PLAN';
      const small = row.querySelector('.v6-layer-copy small');
      if (small) small.textContent = 'Forecast lightning is not included in the current Tomorrow.io plan. Observed Canadian lightning remains available.';
    } else {
      row.classList.remove('v10-plan-locked');
      row.removeAttribute('aria-disabled');
    }
  }

  function updateLegend(id) {
    const legend = document.getElementById('radarLegend');
    if (!legend) return;

    if (id === 'radar') {
      legend.innerHTML = [
        ['v10-db-light', '10–25 dBZ', 'Light'],
        ['v10-db-moderate', '25–35 dBZ', 'Moderate'],
        ['v10-db-heavy', '35–45 dBZ', 'Heavy'],
        ['v10-db-vheavy', '45–55 dBZ', 'Very heavy'],
        ['v10-db-extreme', '55+ dBZ', 'Extreme']
      ].map(([cls, range, label]) => `<span title="${range}"><b class="legend-dot ${cls}"></b>${label}<small>${range}</small></span>`).join('');
      const source = document.getElementById('radarSourceLine');
      if (source) source.textContent = 'Forecast reflectivity · dBZ · MapTiler Weather · not observed radar';
      return;
    }

    if (id === 'lightning') {
      legend.innerHTML = '<span class="v10-quality-legend">Observed lightning flash density · ECCC</span>';
      const source = document.getElementById('radarSourceLine');
      if (source) source.textContent = 'Observed Canadian lightning-density analysis · ECCC';
      return;
    }

    if (id === 'lightningForecast') {
      legend.innerHTML = '<span class="v10-quality-legend">Forecast flash-rate density · flashes/km²/5 min</span>';
      const source = document.getElementById('radarSourceLine');
      if (source) source.textContent = 'Forecast lightning activity · Tomorrow.io · not discrete observed strikes';
    }
  }

  async function selectLightningFallback() {
    const engine = window.StormLensMapV10;
    if (!engine?.selectLayer) return;
    const result = await ensureLightningProbe();
    updateLightningRows();
    if (result.available) return engine.selectLayer('lightningForecast');
    return engine.selectLayer('lightning');
  }

  // Register before map-core-v10 binds its own capture listener.
  document.addEventListener('click', event => {
    const quick = event.target.closest?.('#quickLayers [data-layer="lightning"]');
    const forecastRow = event.target.closest?.('[data-v10-weather="lightningForecast"]');
    if (!quick && !forecastRow) return;

    if (forecastRow && entitlements.lightningFlashRateDensity === true) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    selectLightningFallback().catch(error => console.warn('[StormLens lightning fallback]', error));
  }, true);

  window.addEventListener('stormlens:weather-layer-changed', event => {
    const id = event.detail?.id;
    requestAnimationFrame(() => updateLegend(id));
  });

  const observer = new MutationObserver(() => updateLightningRows());
  const startObserver = () => {
    const modal = document.getElementById('layersModal');
    if (modal) observer.observe(modal, { childList: true, subtree: true });
  };

  installRadarPalette();
  ensureLightningProbe().then(() => updateLightningRows());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})();
