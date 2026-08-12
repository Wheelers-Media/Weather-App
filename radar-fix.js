(() => {
  if (!window.L || !L.map || !L.tileLayer?.wms) return;

  const originalMapFactory = L.map;
  window.StormLensOriginalWms = L.tileLayer.wms;
  let fallbackStarted = false;
  let pendingLayer = null;
  let routerInstalled = false;

  L.map = function (...args) {
    const map = originalMapFactory.apply(this, args);
    window.StormLensMap = map;
    setTimeout(() => window.dispatchEvent(new CustomEvent('stormlens:map-ready', { detail:{ map } })), 0);
    return map;
  };

  function activeEngine() {
    const mode = document.documentElement.dataset.mapEngine;
    if (mode === 'v7' && window.StormLensMapV7?.selectLayer) return window.StormLensMapV7;
    if (mode === 'v6' && window.StormLensMapV6?.selectLayer) return window.StormLensMapV6;
    if (window.StormLensMapV7?.selectLayer && !fallbackStarted) return window.StormLensMapV7;
    if (window.StormLensMapV6?.selectLayer) return window.StormLensMapV6;
    return null;
  }

  function normalizeLegacyLayer(key, engine) {
    const isV7 = engine === window.StormLensMapV7;
    const maps = isV7 ? {
      radar:'observedRadar', nowcast:'nowcast', lightning:'lightning', storms:'thunderRisk', alerts:'alerts',
      futureprecip:'precipitation', preciptype:'precipType', precipprob:'precipProb', temperature:'temperature', windgust:'windGust'
    } : {
      radar:'radar', nowcast:'nowcast', lightning:'lightning', storms:'thunderRisk', alerts:'alerts',
      futureprecip:'futurePrecip', preciptype:'precipType', precipprob:'precipProb', temperature:'temperature', windgust:'windGust'
    };
    return maps[key] || key;
  }

  function syncQuickSelection(id) {
    const quick = id === 'radar' || id === 'observedRadar' ? 'radar'
      : id === 'nowcast' ? 'nowcast'
      : id === 'lightning' ? 'lightning'
      : id === 'thunderRisk' ? 'storms'
      : id === 'alerts' ? 'alerts'
      : null;
    document.querySelectorAll('#quickLayers [data-layer]').forEach(button => {
      const key = button.dataset.layer;
      button.classList.toggle('active', Boolean(quick && key === quick));
      button.setAttribute('aria-pressed', String(Boolean(quick && key === quick)));
    });
  }

  function requestLayer(rawId, closeSheet = false) {
    const engine = activeEngine();
    if (!engine) {
      pendingLayer = { rawId, closeSheet };
      return;
    }
    const id = normalizeLegacyLayer(rawId, engine);
    if (!engine.defs?.[id]) return;
    pendingLayer = null;
    Promise.resolve(engine.selectLayer(id)).catch(error => {
      console.warn('[StormLens layer router]', error);
    });
    if (closeSheet) {
      const modal = document.getElementById('layersModal');
      if (modal) modal.hidden = true;
    }
  }

  function flushPending() {
    if (!pendingLayer || !activeEngine()) return;
    const pending = pendingLayer;
    pendingLayer = null;
    requestLayer(pending.rawId, pending.closeSheet);
  }

  function installInputRouter() {
    if (routerInstalled) return;
    routerInstalled = true;

    // radar-fix.js loads before app.js, so this capture listener owns all map-layer taps
    // before the legacy app can run its older single-layer handlers.
    document.addEventListener('click', event => {
      const quick = event.target.closest?.('#quickLayers [data-layer]');
      if (quick) {
        const key = quick.dataset.layer;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 'layers') {
          const engine = activeEngine();
          if (engine?.openLayers) engine.openLayers();
          else {
            const modal = document.getElementById('layersModal');
            if (modal) modal.hidden = false;
          }
          return;
        }
        requestLayer(key, false);
        return;
      }

      const v7 = event.target.closest?.('[data-v7-weather]');
      if (v7) {
        event.preventDefault(); event.stopImmediatePropagation();
        requestLayer(v7.dataset.v7Weather, true);
        return;
      }

      const v6 = event.target.closest?.('[data-v6-weather]');
      if (v6) {
        event.preventDefault(); event.stopImmediatePropagation();
        requestLayer(v6.dataset.v6Weather, true);
        return;
      }

      const legacy = event.target.closest?.('[data-select-layer]');
      if (legacy) {
        event.preventDefault(); event.stopImmediatePropagation();
        requestLayer(legacy.dataset.selectLayer, true);
        return;
      }

      const alertToggle = event.target.closest?.('[data-toggle-alerts]');
      if (alertToggle && !alertToggle.hidden) {
        event.preventDefault(); event.stopImmediatePropagation();
        requestLayer('alerts', true);
      }
    }, true);

    window.addEventListener('stormlens:weather-layer-changed', event => {
      const id = event.detail?.id;
      if (id) syncQuickSelection(id);
    });

    const readyEvents = ['stormlens:map-ready','stormlens:v7-ready'];
    readyEvents.forEach(name => window.addEventListener(name, () => setTimeout(flushPending, 40)));
    setInterval(flushPending, 250);
  }

  installInputRouter();

  function addStylesheet(href, marker) {
    const existing = document.querySelector(`link[data-stormlens-style="${marker}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true' || existing.sheet) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => { existing.dataset.loaded='true'; resolve(existing); }, { once:true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load stylesheet ${marker}`)), { once:true });
      });
    }
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel='stylesheet';
      link.href=href;
      link.dataset.stormlensStyle=marker;
      link.addEventListener('load', () => { link.dataset.loaded='true'; resolve(link); }, { once:true });
      link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet ${marker}`)), { once:true });
      document.head.appendChild(link);
    });
  }

  function loadScript(src, marker) {
    const existing=document.querySelector(`script[data-stormlens-script="${marker}"]`);
    if (existing) {
      if (existing.dataset.loaded==='true') return Promise.resolve(existing);
      return new Promise((resolve,reject)=>{
        existing.addEventListener('load',()=>resolve(existing),{once:true});
        existing.addEventListener('error',()=>reject(new Error(`Failed to load ${marker}`)),{once:true});
      });
    }
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.dataset.stormlensScript=marker;
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(script);},{once:true});
      script.addEventListener('error',()=>reject(new Error(`Failed to load ${marker}`)),{once:true});
      document.body.appendChild(script);
    });
  }

  function ensureLegacyAlertHook() {
    if (document.querySelector('[data-toggle-alerts]')) return;
    const button=document.createElement('button');
    button.type='button';
    button.hidden=true;
    button.dataset.toggleAlerts='true';
    document.body.appendChild(button);
  }

  async function loadV6(reason='') {
    if (fallbackStarted) return;
    fallbackStarted = true;
    try { window.StormLensMapV7?.stopPlayback?.(); } catch (_) {}
    try { window.StormLensMapV7?.map?.remove?.(); } catch (_) {}
    document.getElementById('stormlensMapV7')?.remove();
    const legacy = document.getElementById('weatherMap');
    if (legacy) { legacy.style.opacity='1'; legacy.style.pointerEvents='auto'; }
    await Promise.all([
      addStylesheet('map-v6.css?v=20260812-4','map-v6'),
      addStylesheet('premium-data.css?v=20260812-1','premium-data')
    ]);
    await loadScript('map-v6.js?v=20260812-4','map-v6');
    await loadScript('map-v6-guard.js?v=20260812-4','map-v6-guard');
    await loadScript('premium-bridge.js?v=20260812-6','premium-bridge-v6');
    document.documentElement.dataset.mapEngine='v6';
    flushPending();
    const status=document.getElementById('mapLayerStatus');
    if (status && reason) status.dataset.fallbackReason = reason;
  }

  async function loadV7() {
    await Promise.all([
      addStylesheet('map-v6.css?v=20260812-4','map-v6-shared-ui'),
      addStylesheet('map-v7.css?v=20260812-3','map-v7'),
      addStylesheet('premium-data.css?v=20260812-1','premium-data'),
      addStylesheet('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.css','maptiler-sdk')
    ]);

    await loadScript('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.umd.min.js','maptiler-sdk');
    await loadScript('https://cdn.maptiler.com/maptiler-weather/v3.1.1/maptiler-weather.umd.min.js','maptiler-weather');
    await loadScript('map-v7-compat.js?v=20260812-3','map-v7-compat');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await loadScript('map-v7.js?v=20260812-3','map-v7');
    await loadScript('map-v7-runtime.js?v=20260812-3','map-v7-runtime');
    await loadScript('map-v7-watchdog.js?v=20260812-2','map-v7-watchdog');
    await loadScript('premium-bridge.js?v=20260812-6','premium-bridge-v7');
    document.documentElement.dataset.mapEngine='v7';
    flushPending();
  }

  window.addEventListener('stormlens:v7-fatal', event => {
    const reason = event.detail?.reason || 'Map service unavailable';
    console.warn('[StormLens] V7 watchdog requested fallback:', reason);
    loadV6(reason).catch(error => console.error('[StormLens] V6 fallback failed', error));
  });

  async function loadEngine() {
    ensureLegacyAlertHook();
    const hasMapTiler=Boolean(window.STORMLENS_PUBLIC_CONFIG?.mapTilerApiKey);
    if (!hasMapTiler) {
      console.info('[StormLens] MAPTILER_API_KEY not configured in this deployment. Using V6 map engine.');
      return loadV6('MapTiler not configured');
    }
    try {
      await loadV7();
      console.info('[StormLens] MapTiler V7 weather engine ready.');
    } catch (error) {
      console.warn('[StormLens] MapTiler V7 failed to initialize. Falling back to V6.',error);
      await loadV6('V7 startup failed');
    }
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadEngine,{once:true});
  else loadEngine();
})();