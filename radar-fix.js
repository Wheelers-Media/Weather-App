(() => {
  if (!window.L || !L.tileLayer || !L.tileLayer.wms) return;

  const originalMapFactory = L.map;
  const originalWms = L.tileLayer.wms;
  const META_URL = 'https://api.rainviewer.com/public/weather-maps.json';
  let cache = null;
  let cacheAt = 0;

  // Capture the Leaflet map without changing the main application API. This lets
  // the premium overlay engine add multiple independent layers on top of the map.
  L.map = function (...args) {
    const map = originalMapFactory.apply(this, args);
    window.StormLensMap = map;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('stormlens:map-ready', { detail: { map } }));
    }, 0);
    return map;
  };

  async function getFrames(force = false) {
    if (!force && cache && Date.now() - cacheAt < 4 * 60 * 1000) return cache;
    const response = await fetch(`${META_URL}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`RainViewer metadata ${response.status}`);
    const data = await response.json();
    const frames = data?.radar?.past || [];
    if (!data?.host || !frames.length) throw new Error('No radar frames returned');
    cache = { host: data.host, frames };
    cacheAt = Date.now();
    return cache;
  }

  function nearestFrame(frames, desiredTime) {
    if (!frames.length) return null;
    if (!desiredTime) return frames[frames.length - 1];
    const wanted = new Date(desiredTime).getTime() / 1000;
    if (!Number.isFinite(wanted)) return frames[frames.length - 1];
    return frames.reduce((best, frame) =>
      Math.abs(frame.time - wanted) < Math.abs(best.time - wanted) ? frame : best,
      frames[0]
    );
  }

  function tileUrl(host, frame) {
    return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  }

  function setRainViewerLegend() {
    if (window.StormLensPremiumOverlays?.ownsLegend) return;
    const legend = document.getElementById('radarLegend');
    if (!legend) return;
    legend.innerHTML = '<span><b class="legend-dot rv1"></b>Light</span><span><b class="legend-dot rv2"></b>Moderate</span><span><b class="legend-dot rv3"></b>Heavy</span><span><b class="legend-dot rv4"></b>Intense</span>';
  }

  function createRainViewerLayer(options) {
    const opacity = Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : 0.78;
    const layer = L.tileLayer('', {
      opacity,
      maxNativeZoom: 7,
      maxZoom: 19,
      keepBuffer: 3,
      updateWhenIdle: false,
      crossOrigin: true,
      className: 'stormlens-radar-tiles'
    });

    layer._stormlensProvider = 'rainviewer-fallback';
    layer._stormlensDefaultOpacity = opacity;

    let desiredTime = null;
    let provider = null;
    let loadGeneration = 0;

    const status = text => {
      if (window.StormLensPremiumOverlays?.ownsStatus) return;
      const el = document.getElementById('mapLayerStatus');
      if (el) el.textContent = text;
    };

    const source = text => {
      if (window.StormLensPremiumOverlays?.ownsStatus) return;
      const el = document.getElementById('radarSourceLine');
      if (el) el.textContent = text;
    };

    async function refresh(force = false) {
      const generation = ++loadGeneration;
      try {
        status('Observed radar · connecting');
        provider = await getFrames(force);
        if (generation !== loadGeneration) return;
        const frame = nearestFrame(provider.frames, desiredTime);
        if (!frame) throw new Error('No radar frame');
        layer.setUrl(tileUrl(provider.host, frame), false);
        layer._stormlensFrameTime = frame.time;
        setRainViewerLegend();
        source('Fallback radar by RainViewer · Canadian layers and alerts by ECCC');
      } catch (error) {
        status('Radar provider unavailable');
        source('Observed radar could not connect. Canadian ECCC layers remain available.');
        console.error('[StormLens radar fallback]', error);
      }
    }

    layer.setParams = function(params = {}, noRedraw = false) {
      if (params.time) desiredTime = params.time;
      if (provider?.frames?.length) {
        const frame = nearestFrame(provider.frames, desiredTime);
        if (frame) {
          this._stormlensFrameTime = frame.time;
          this.setUrl(tileUrl(provider.host, frame), noRedraw);
        }
      } else {
        refresh(false);
      }
      setTimeout(setRainViewerLegend, 0);
      return this;
    };
    layer.wmsParams = { layers: 'RADAR_1KM_RRAI', styles: '', format: 'image/png', transparent: true };

    let tileLoads = 0;
    let tileErrors = 0;
    layer.on('loading', () => status('Observed radar · loading'));
    layer.on('tileload', () => {
      tileLoads += 1;
      setRainViewerLegend();
      if (tileLoads === 1) status('Observed radar · LIVE');
    });
    layer.on('tileerror', () => {
      tileErrors += 1;
      if (tileLoads === 0 && tileErrors === 4) {
        status('Radar · refreshing fallback');
        refresh(true);
      } else if (tileLoads === 0 && tileErrors >= 10) {
        status('Radar fallback unavailable');
      }
    });

    refresh(false);
    return layer;
  }

  // The legacy application still asks for RADAR_1KM_RRAI. Keep RainViewer as a
  // graceful fallback while the premium engine tries official ECCC classic radar.
  L.tileLayer.wms = function(url, options = {}) {
    if (options.layers === 'RADAR_1KM_RRAI') return createRainViewerLayer(options);
    return originalWms.call(this, url, options);
  };
  window.StormLensOriginalWms = originalWms;

  function loadPremiumEngine() {
    if (!document.querySelector('link[data-stormlens-premium]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'premium-overlays.css?v=20260812-1';
      css.dataset.stormlensPremium = 'true';
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[data-stormlens-premium]')) {
      const script = document.createElement('script');
      script.src = 'premium-overlays.js?v=20260812-1';
      script.dataset.stormlensPremium = 'true';
      script.async = true;
      document.body.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPremiumEngine, { once: true });
  } else {
    loadPremiumEngine();
  }
})();
