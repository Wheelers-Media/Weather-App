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
    if (document.querySelector(`link[data-${marker}]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet'; link.href=href; link.dataset[marker]='true';
    document.head.appendChild(link);
  }

  function addScript(src, marker) {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script=document.createElement('script');
    script.src=src; script.dataset[marker]='true'; script.async=false;
    document.body.appendChild(script);
  }

  function ensureLegacyAlertHook() {
    if (document.querySelector('[data-toggle-alerts]')) return;
    const button=document.createElement('button');
    button.type='button'; button.hidden=true; button.dataset.toggleAlerts='true';
    document.body.appendChild(button);
  }

  function loadEngine() {
    ensureLegacyAlertHook();
    addStylesheet('map-v6.css?v=20260812-1','stormlensMapV6');
    addStylesheet('premium-data.css?v=20260812-1','premiumData');
    addScript('map-v6.js?v=20260812-1','stormlensMapV6');
    addScript('map-v6-guard.js?v=20260812-1','stormlensMapV6Guard');
    addScript('premium-bridge.js?v=20260812-4','stormlensBridge');
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadEngine,{once:true});
  else loadEngine();
})();
