(() => {
  if (!window.L || !L.map || !L.tileLayer?.wms) return;

  const originalMapFactory = L.map;
  window.StormLensOriginalWms = L.tileLayer.wms;

  L.map = function (...args) {
    const map = originalMapFactory.apply(this, args);
    window.StormLensMap = map;
    setTimeout(() => window.dispatchEvent(new CustomEvent('stormlens:map-ready', { detail:{ map } })), 0);
    return map;
  };

  function addStylesheet(href, marker) {
    if (document.querySelector(`link[data-stormlens-style="${marker}"]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset.stormlensStyle=marker;
    document.head.appendChild(link);
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

  async function loadV6() {
    addStylesheet('map-v6.css?v=20260812-2','map-v6');
    addStylesheet('premium-data.css?v=20260812-1','premium-data');
    await loadScript('map-v6.js?v=20260812-2','map-v6');
    await loadScript('map-v6-guard.js?v=20260812-2','map-v6-guard');
    await loadScript('premium-bridge.js?v=20260812-4','premium-bridge');
    document.documentElement.dataset.mapEngine='v6';
  }

  async function loadV7() {
    addStylesheet('map-v6.css?v=20260812-2','map-v6-shared-ui');
    addStylesheet('map-v7.css?v=20260812-1','map-v7');
    addStylesheet('premium-data.css?v=20260812-1','premium-data');
    addStylesheet('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.css','maptiler-sdk');

    await loadScript('https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.umd.min.js','maptiler-sdk');
    await loadScript('https://cdn.maptiler.com/maptiler-weather/v3.1.1/maptiler-weather.umd.min.js','maptiler-weather');
    await loadScript('map-v7-compat.js?v=20260812-1','map-v7-compat');
    await loadScript('map-v7.js?v=20260812-1','map-v7');
    await loadScript('map-v7-runtime.js?v=20260812-1','map-v7-runtime');
    await loadScript('premium-bridge.js?v=20260812-4','premium-bridge');
    document.documentElement.dataset.mapEngine='v7';
  }

  async function loadEngine() {
    ensureLegacyAlertHook();
    const hasMapTiler=Boolean(window.STORMLENS_PUBLIC_CONFIG?.mapTilerApiKey);
    if (!hasMapTiler) {
      console.info('[StormLens] MAPTILER_API_KEY not configured in this deployment. Using V6 map engine.');
      return loadV6();
    }
    try {
      await loadV7();
      console.info('[StormLens] MapTiler V7 weather engine ready.');
    } catch (error) {
      console.warn('[StormLens] MapTiler V7 failed to initialize. Falling back to V6.',error);
      await loadV6();
    }
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadEngine,{once:true});
  else loadEngine();
})();
