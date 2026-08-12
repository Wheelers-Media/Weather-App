(() => {
  'use strict';

  const DENSITY_SOURCE = 'stormlens-storm-lightning-density-source';
  const DENSITY_LAYER = 'stormlens-storm-lightning-density-layer';
  const STRIKE_SOURCE = 'stormlens-exact-lightning-source';
  const STRIKE_LAYER = 'stormlens-exact-lightning-layer';
  const WMS = 'https://geo.weather.gc.ca/geomet?';

  let selected = null;
  let pollTimer = null;
  let providerStatus = null;
  let lastStrikeStamp = 0;

  function map() { return window.StormLensMapV10?.map || null; }
  function locationState() {
    try {
      const loc = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      if (loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) return loc;
    } catch (_) {}
    return { latitude:51.0447, longitude:-114.0719 };
  }

  function firstLabelLayer(m) {
    const layers = m?.getStyle?.()?.layers || [];
    return layers.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
  }

  function removeLayerAndSource(layerId, sourceId) {
    const m = map(); if (!m) return;
    try { if (m.getLayer(layerId)) m.removeLayer(layerId); } catch (_) {}
    try { if (m.getSource(sourceId)) m.removeSource(sourceId); } catch (_) {}
  }

  function clearDensity() { removeLayerAndSource(DENSITY_LAYER, DENSITY_SOURCE); }
  function clearStrikes() { removeLayerAndSource(STRIKE_LAYER, STRIKE_SOURCE); }

  function addDensity() {
    const m = map();
    if (!m?.isStyleLoaded?.() || selected !== 'storm') return;
    if (m.getSource(DENSITY_SOURCE)) return;
    const params = new URLSearchParams({
      SERVICE:'WMS', REQUEST:'GetMap', VERSION:'1.1.1',
      LAYERS:'Lightning_2.5km_Density', STYLES:'Lightning',
      FORMAT:'image/png', TRANSPARENT:'true', SRS:'EPSG:3857',
      WIDTH:'512', HEIGHT:'512'
    });
    m.addSource(DENSITY_SOURCE, {
      type:'raster',
      tiles:[`${WMS}${params.toString()}&BBOX={bbox-epsg-3857}`],
      tileSize:512,
      minzoom:1,
      maxzoom:12,
      attribution:'Environment and Climate Change Canada'
    });
    const layer = {
      id:DENSITY_LAYER,
      type:'raster',
      source:DENSITY_SOURCE,
      paint:{ 'raster-opacity':0.64, 'raster-resampling':'linear', 'raster-fade-duration':180 }
    };
    const before = firstLabelLayer(m);
    try { before ? m.addLayer(layer, before) : m.addLayer(layer); } catch (_) {}
  }

  async function getProviderStatus() {
    if (providerStatus) return providerStatus;
    try {
      const response = await fetch('/api/provider-status', { cache:'no-store' });
      providerStatus = response.ok ? await response.json() : {};
    } catch (_) { providerStatus = {}; }
    return providerStatus;
  }

  function extractStrikes(data) {
    const rows = Array.isArray(data?.response) ? data.response : Array.isArray(data) ? data : [];
    return rows.map(row => {
      const loc = row?.loc || row?.location || {};
      const lat = Number(loc.lat ?? loc.latitude ?? row?.lat ?? row?.latitude);
      const lon = Number(loc.long ?? loc.lon ?? loc.longitude ?? row?.long ?? row?.lon ?? row?.longitude);
      const timestamp = Number(row?.ob?.timestamp ?? row?.timestamp ?? row?.dateTimeEpoch ?? 0);
      const amperage = Number(row?.ob?.amperage ?? row?.ob?.peakAmp ?? row?.amperage ?? 0);
      return { lat, lon, timestamp, amperage };
    }).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));
  }

  function distanceKm(aLat,aLon,bLat,bLon) {
    const r=6371, p1=aLat*Math.PI/180, p2=bLat*Math.PI/180;
    const dp=(bLat-aLat)*Math.PI/180, dl=(bLon-aLon)*Math.PI/180;
    const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*r*Math.asin(Math.sqrt(a));
  }

  function renderStrikes(strikes) {
    const m = map(); if (!m?.isStyleLoaded?.()) return;
    const now = Date.now()/1000;
    const geojson = {
      type:'FeatureCollection',
      features:strikes.map(s => ({
        type:'Feature',
        properties:{ age:Math.max(0,now-s.timestamp), amperage:s.amperage || 0, timestamp:s.timestamp || 0 },
        geometry:{ type:'Point', coordinates:[s.lon,s.lat] }
      }))
    };
    if (m.getSource(STRIKE_SOURCE)) m.getSource(STRIKE_SOURCE).setData(geojson);
    else {
      m.addSource(STRIKE_SOURCE, { type:'geojson', data:geojson });
      const layer = {
        id:STRIKE_LAYER, type:'circle', source:STRIKE_SOURCE,
        paint:{
          'circle-radius':['interpolate',['linear'],['get','age'],0,5.5,300,3.2],
          'circle-color':['interpolate',['linear'],['get','age'],0,'#fff4a3',120,'#ffd33d',300,'#ff8a34'],
          'circle-opacity':['interpolate',['linear'],['get','age'],0,1,300,0.32],
          'circle-stroke-color':'rgba(255,255,255,.9)', 'circle-stroke-width':1
        }
      };
      const before = firstLabelLayer(m);
      try { before ? m.addLayer(layer,before) : m.addLayer(layer); } catch (_) {}
    }
  }

  async function refreshExactLightning() {
    if (!['storm','lightning'].includes(selected)) { clearStrikes(); return; }
    const status = await getProviderStatus();
    if (!status.xweather) { clearStrikes(); return; }
    const loc = locationState();
    try {
      const response = await fetch(`/api/xweather-lightning?lat=${encodeURIComponent(loc.latitude)}&lon=${encodeURIComponent(loc.longitude)}&radius=100&limit=750`, { cache:'no-store' });
      if (!response.ok) return;
      const strikes = extractStrikes(await response.json());
      renderStrikes(strikes);
      const newest = Math.max(0, ...strikes.map(s => s.timestamp || 0));
      if (lastStrikeStamp > 0 && newest > lastStrikeStamp) {
        const nearbyNew = strikes.some(s => (s.timestamp || 0) > lastStrikeStamp && distanceKm(Number(loc.latitude),Number(loc.longitude),s.lat,s.lon) <= 25);
        if (nearbyNew && document.visibilityState === 'visible' && navigator.vibrate) navigator.vibrate(12);
      }
      if (newest) lastStrikeStamp = Math.max(lastStrikeStamp,newest);
    } catch (_) {}
  }

  function refreshComposite() {
    if (selected === 'storm') addDensity(); else clearDensity();
    refreshExactLightning();
    clearInterval(pollTimer);
    pollTimer = setInterval(refreshExactLightning, 45000);
  }

  window.addEventListener('stormlens:weather-layer-changed', event => {
    selected = event.detail?.id || null;
    setTimeout(refreshComposite, 50);
  });
  window.addEventListener('stormlens:map-ready', () => setTimeout(refreshComposite, 150));
  window.addEventListener('beforeunload', () => clearInterval(pollTimer));
})();
