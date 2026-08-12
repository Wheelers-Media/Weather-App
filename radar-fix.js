(() => {
  if (!window.L || !L.map || !L.tileLayer?.wms) return;

  const originalMapFactory = L.map;
  window.StormLensOriginalWms = L.tileLayer.wms;
  let fallbackStarted = false;
  let pendingLayer = null;
  let queuedLayer = null;
  let switchingLayer = false;
  let routerInstalled = false;

  L.map = function (...args) {
    const map = originalMapFactory.apply(this, args);
    window.StormLensMap = map;
    setTimeout(() => window.dispatchEvent(new CustomEvent('stormlens:map-ready', { detail:{ map } })), 0);
    return map;
  };

  function activeEngine() {
    const mode = document.documentElement.dataset.mapEngine;
    if (mode === 'v8' && window.StormLensMapV8?.selectLayer) return window.StormLensMapV8;
    if (mode === 'v6' && window.StormLensMapV6?.selectLayer) return window.StormLensMapV6;
    if (window.StormLensMapV8?.selectLayer && !fallbackStarted) return window.StormLensMapV8;
    if (window.StormLensMapV6?.selectLayer) return window.StormLensMapV6;
    return null;
  }

  function normalizeLegacyLayer(key, engine) {
    const isV8 = engine === window.StormLensMapV8;
    const stormLayer = isV8 && engine.tomorrowEnabled && engine.defs?.futureThunderstorms ? 'futureThunderstorms' : 'thunderRisk';
    const maps = isV8 ? {
      radar:'observedRadar', nowcast:'nowcast', lightning:'lightning', storms:stormLayer, alerts:'alerts',
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
      : id === 'thunderRisk' || id === 'futureThunderstorms' ? 'storms'
      : id === 'alerts' ? 'alerts'
      : null;
    document.querySelectorAll('#quickLayers [data-layer]').forEach(button => {
      const key = button.dataset.layer;
      const selected = Boolean(quick && key === quick);
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function setSwitchingUI(on) {
    document.documentElement.dataset.layerSwitching = on ? 'true' : 'false';
    document.querySelectorAll('#quickLayers [data-layer]:not([data-layer="layers"])').forEach(button => {
      button.setAttribute('aria-busy', String(on));
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
    if (switchingLayer) {
      queuedLayer = { rawId, closeSheet };
      return;
    }

    switchingLayer = true;
    pendingLayer = null;
    setSwitchingUI(true);
    if (closeSheet) {
      const modal = document.getElementById('layersModal');
      if (modal) modal.hidden = true;
    }

    Promise.resolve(engine.selectLayer(id)).catch(error => {
      console.warn('[StormLens layer router]', error);
    }).finally(() => {
      switchingLayer = false;
      setSwitchingUI(false);
      if (queuedLayer) {
        const next = queuedLayer;
        queuedLayer = null;
        requestLayer(next.rawId, next.closeSheet);
      }
    });
  }

  function flushPending() {
    if (!pendingLayer || !activeEngine() || switchingLayer) return;
    const pending = pendingLayer;
    pendingLayer = null;
    requestLayer(pending.rawId, pending.closeSheet);
  }

  function openMapScreen() {
    document.querySelector('.nav-item[data-target="map"]')?.click();
  }

  function installInputRouter() {
    if (routerInstalled) return;
    routerInstalled = true;

    document.addEventListener('click', event => {
      const quick = event.target.closest?.('#quickLayers [data-layer]');
      if (quick) {
        const key = quick.dataset.layer;
        event.preventDefault(); event.stopImmediatePropagation();
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

      const v8 = event.target.closest?.('[data-v8-weather]');
      if (v8) {
        event.preventDefault(); event.stopImmediatePropagation();
        requestLayer(v8.dataset.v8Weather, true);
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
        return;
      }

      if (event.target.closest?.('#openStormMap')) {
        event.preventDefault(); event.stopImmediatePropagation();
        openMapScreen();
        setTimeout(() => requestLayer('storms', false), 160);
        return;
      }

      if (event.target.closest?.('#openLightningMap')) {
        event.preventDefault(); event.stopImmediatePropagation();
        openMapScreen();
        setTimeout(() => requestLayer('lightning', false), 160);
      }
    }, true);

    window.addEventListener('stormlens:weather-layer-changed', event => {
      const id = event.detail?.id;
      if (id) syncQuickSelection(id);
    });

    ['stormlens:map-ready','stormlens:v8-ready'].forEach(name => window.addEventListener(name, () => setTimeout(flushPending, 40)));
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
      link.rel='stylesheet'; link.href=href; link.dataset.stormlensStyle=marker;
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
      script.src=src; script.async=false; script.dataset.stormlensScript=marker;
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(script);},{once:true});
      script.addEventListener('error',()=>reject(new Error(`Failed to load ${marker}`)),{once:true});
      document.body.appendChild(script);
    });
  }

  function ensureLegacyAlertHook() {
    if (document.querySelector('[data-toggle-alerts]')) return;
    const button=document.createElement('button');
    button.type='button'; button.hidden=true; button.dataset.toggleAlerts='true';
    document.body.appendChild(button);
  }

  async function loadV6(reason='') {
    if (fallbackStarted) return;
    fallbackStarted = true;
    try { window.StormLensMapV8?.stopPlayback?.(); } catch (_) {}
    try { window.StormLensMapV8?.map?.remove?.(); } catch (_) {}
    document.getElementById('stormlensMapV8')?.remove();
    const legacy = document.getElementById('weatherMap');
    if (legacy) { legacy.style.opacity='1'; legacy.style.pointerEvents='auto'; }
    await Promise.all([
      addStylesheet('map-v6.css?v=20260812-9','map-v6'),
      addStylesheet('premium-data.css?v=20260812-1','premium-data')
    ]);
    await loadScript('map-v6.js?v=20260812-9','map-v6');
    await loadScript('map-v6-guard.js?v=20260812-9','map-v6-guard');
    await loadScript('premium-bridge.js?v=20260812-10','premium-bridge-v6');
    document.documentElement.dataset.mapEngine='v6';
    flushPending();
    const status=document.getElementById('mapLayerStatus');
    if (status && reason) status.dataset.fallbackReason = reason;
  }

  function mapScreenHasLayout() {
    const screen = document.getElementById('mapScreen');
    if (!screen || !screen.classList.contains('active')) return false;
    const rect = screen.getBoundingClientRect();
    return rect.width >= 240 && rect.height >= 320;
  }

  function waitForMapScreenVisible() {
    if (mapScreenHasLayout()) return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done || !mapScreenHasLayout()) return;
        done = true;
        observer?.disconnect();
        document.removeEventListener('click', onClick, true);
        clearInterval(poll);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      };
      const screen = document.getElementById('mapScreen');
      const observer = screen && window.MutationObserver ? new MutationObserver(finish) : null;
      observer?.observe(screen, { attributes:true, attributeFilter:['class','style'] });
      const onClick = event => {
        if (event.target.closest?.('.nav-item[data-target="map"]')) setTimeout(finish, 100);
      };
      document.addEventListener('click', onClick, true);
      const poll = setInterval(finish, 120);
    });
  }

  function waitForV8Ready(timeoutMs=18000) {
    if (document.documentElement.dataset.mapEngine === 'v8' && window.StormLensMapV8?.map) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let done=false;
      const finish=(ok,error)=>{
        if(done)return;done=true;
        clearTimeout(timer);
        window.removeEventListener('stormlens:v8-ready',onReady);
        window.removeEventListener('stormlens:v8-fatal',onFatal);
        ok?resolve():reject(error||new Error('V8 map failed'));
      };
      const onReady=()=>finish(true);
      const onFatal=event=>finish(false,new Error(event.detail?.reason||'V8 map failed'));
      const timer=setTimeout(()=>finish(false,new Error('V8 map did not become ready')),timeoutMs);
      window.addEventListener('stormlens:v8-ready',onReady,{once:true});
      window.addEventListener('stormlens:v8-fatal',onFatal,{once:true});
    });
  }

  async function assertV8Canvas() {
    const engine = window.StormLensMapV8;
    const map = engine?.map;
    if (!map) throw new Error('V8 map instance missing');
    try { map.resize?.(); } catch (_) {}
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = map.getCanvas?.();
    const container = document.getElementById('stormlensMapV8');
    const rect = container?.getBoundingClientRect?.();
    const cssWidth = Number(rect?.width || 0);
    const cssHeight = Number(rect?.height || 0);
    const pixelWidth = Number(canvas?.width || 0);
    const pixelHeight = Number(canvas?.height || 0);
    const styleLoaded = Boolean(map.isStyleLoaded?.());
    if (!styleLoaded || cssWidth < 240 || cssHeight < 320 || pixelWidth < 240 || pixelHeight < 320) {
      throw new Error('WebGL map canvas did not size correctly');
    }
  }

  async function loadV8() {
    await Promise.all([
      addStylesheet('map-v6.css?v=20260812-9','map-v6-shared-ui'),
      addStylesheet('map-v8.css?v=20260812-2','map-v8'),
      addStylesheet('premium-data.css?v=20260812-1','premium-data'),
      addStylesheet('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.css','maptiler-sdk')
    ]);
    await loadScript('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.umd.min.js','maptiler-sdk');
    await loadScript('https://cdn.maptiler.com/maptiler-weather/v3.1.1/maptiler-weather.umd.min.js','maptiler-weather');

    // MapLibre/MapTiler must be created in a visible, non-zero-sized container.
    // Creating it while the Home screen is active can produce a blank Android canvas.
    await waitForMapScreenVisible();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await loadScript('map-v8.js?v=20260812-2','map-v8');
    await loadScript('premium-home.js?v=20260812-1','premium-home-v8');
    await waitForV8Ready();
    await assertV8Canvas();
    document.documentElement.dataset.mapEngine='v8';
    flushPending();
  }

  window.addEventListener('stormlens:v8-fatal', event => {
    if (fallbackStarted) return;
    const reason = event.detail?.reason || 'Map service unavailable';
    console.warn('[StormLens] V8 requested fallback:', reason);
    switchingLayer=false; queuedLayer=null; setSwitchingUI(false);
    loadV6(reason).catch(error=>console.error('[StormLens] V6 fallback failed',error));
  });

  async function loadEngine() {
    ensureLegacyAlertHook();
    const hasMapTiler=Boolean(window.STORMLENS_PUBLIC_CONFIG?.mapTilerApiKey);
    if (!hasMapTiler) {
      console.info('[StormLens] MAPTILER_API_KEY not configured. Using V6 map engine.');
      return loadV6('MapTiler not configured');
    }
    try {
      await loadV8();
      console.info('[StormLens] V8 map and timeline engine ready.');
    } catch (error) {
      console.warn('[StormLens] V8 failed to initialize. Falling back to V6.',error);
      await loadV6(error?.message || 'V8 startup failed');
    }
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadEngine,{once:true});
  else loadEngine();
})();