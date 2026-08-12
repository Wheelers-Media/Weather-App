(() => {
  if (!window.L || !L.map || !L.tileLayer?.wms) return;

  const originalMapFactory = L.map;
  window.StormLensOriginalWms = L.tileLayer.wms;
  let fallbackStarted = false;

  L.map = function (...args) {
    const map = originalMapFactory.apply(this, args);
    window.StormLensMap = map;
    setTimeout(() => window.dispatchEvent(new CustomEvent('stormlens:map-ready', { detail:{ map } })), 0);
    return map;
  };

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
      addStylesheet('map-v6.css?v=20260812-3','map-v6'),
      addStylesheet('premium-data.css?v=20260812-1','premium-data')
    ]);
    await loadScript('map-v6.js?v=20260812-3','map-v6');
    await loadScript('map-v6-guard.js?v=20260812-3','map-v6-guard');
    await loadScript('premium-bridge.js?v=20260812-5','premium-bridge-v6');
    document.documentElement.dataset.mapEngine='v6';
    const status=document.getElementById('mapLayerStatus');
    if (status && reason) status.textContent=`Fallback map · ${reason}`;
  }

  async function loadV7() {
    await Promise.all([
      addStylesheet('map-v6.css?v=20260812-3','map-v6-shared-ui'),
      addStylesheet('map-v7.css?v=20260812-2','map-v7'),
      addStylesheet('premium-data.css?v=20260812-1','premium-data'),
      addStylesheet('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.css','maptiler-sdk')
    ]);

    await loadScript('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.umd.min.js','maptiler-sdk');
    await loadScript('https://cdn.maptiler.com/maptiler-weather/v3.1.1/maptiler-weather.umd.min.js','maptiler-weather');
    await loadScript('map-v7-compat.js?v=20260812-2','map-v7-compat');

    // Give the browser two paint passes so the absolute map container has a real size
    // before MapTiler creates its WebGL canvas. This matters on Android/PWA startup.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await loadScript('map-v7.js?v=20260812-2','map-v7');
    await loadScript('map-v7-runtime.js?v=20260812-2','map-v7-runtime');
    await loadScript('map-v7-watchdog.js?v=20260812-1','map-v7-watchdog');
    await loadScript('premium-bridge.js?v=20260812-5','premium-bridge-v7');
    document.documentElement.dataset.mapEngine='v7';
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
