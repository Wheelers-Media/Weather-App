(() => {
  'use strict';

  window.addEventListener('stormlens:map-screen-visible', () => {
    document.dispatchEvent(new CustomEvent('stormlens:map-screen-visible'));
  });

  function addStyle(href, id) {
    if (document.querySelector(`link[data-stormlens-v10="${id}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.stormlensV10 = id;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load ${id}`));
      document.head.appendChild(link);
    });
  }

  function addScript(src, id) {
    if (document.querySelector(`script[data-stormlens-v10="${id}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.stormlensV10 = id;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${id}`));
      document.body.appendChild(script);
    });
  }

  function status(message, state='loading') {
    const label = document.getElementById('mapLayerStatus');
    const pill = document.getElementById('mapStatusPill');
    if (label) label.textContent = message;
    if (pill) pill.dataset.state = state;
  }

  async function boot() {
    try {
      status('Map engine · loading', 'loading');
      await Promise.all([
        addStyle('map-v6.css?v=20260813-5', 'shared-map-ui'),
        addStyle('map-core-v10.css?v=20260813-5', 'map-core-v10'),
        addStyle('map-polish-v10.css?v=20260813-5', 'map-polish-v10'),
        addStyle('premium-details-v12.css?v=20260813-2', 'premium-details-v12'),
        addStyle('timeline-history-v12.css?v=20260813-1', 'timeline-history-v12'),
        addStyle('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.css', 'maptiler-sdk')
      ]);
      await Promise.all([
        addScript('app-polish-v10.js?v=20260813-5', 'app-polish-v10'),
        addScript('premium-details-v12.js?v=20260813-2', 'premium-details-v12'),
        addScript('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.umd.min.js', 'maptiler-sdk')
      ]);
      await addScript('https://cdn.maptiler.com/maptiler-weather/v3.1.1/maptiler-weather.umd.min.js', 'maptiler-weather');
      await Promise.all([
        addScript('weather-runtime-v11.js?v=20260813-5', 'weather-runtime-v11'),
        addScript('map-core-v10.js?v=20260813-5', 'map-core-v10'),
        addScript('timeline-history-v12.js?v=20260813-1', 'timeline-history-v12')
      ]);
      await addScript('map-v10-bridge.js?v=20260813-5', 'map-v10-bridge');
      await Promise.all([
        addScript('location-accuracy-v10.js?v=20260813-5', 'location-accuracy-v10'),
        addScript('storm-composite-v10.js?v=20260813-5', 'storm-composite-v10')
      ]);
      document.documentElement.dataset.mapEngine = 'v10-pending';
      if (document.getElementById('mapScreen')?.classList.contains('active')) {
        document.dispatchEvent(new CustomEvent('stormlens:map-screen-visible'));
      }
    } catch (error) {
      console.error('[StormLens V10 loader]', error);
      status(`Map unavailable · ${error.message || 'engine failed to load'}`, 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();