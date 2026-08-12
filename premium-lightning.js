(() => {
  let map = null;
  let status = null;
  let group = null;
  let rings = null;
  let timer = null;
  let metric = null;
  let providerEnabled = false;
  let selectedLayer = null;

  async function providerStatus() {
    if (status) return status;
    try {
      const response = await fetch('/api/provider-status', { cache:'no-store' });
      status = response.ok ? await response.json() : {};
    } catch (_) { status = {}; }
    return status;
  }

  function location() {
    try { return JSON.parse(localStorage.getItem('stormlens-location') || 'null'); }
    catch (_) { return null; }
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    const r = 6371;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2-lat1) * Math.PI / 180, dl = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*r*Math.asin(Math.sqrt(a));
  }

  function extractStrikes(data) {
    const rows = Array.isArray(data?.response) ? data.response : Array.isArray(data) ? data : [];
    return rows.map(row => {
      const loc = row?.loc || row?.location || {};
      const lat = Number(loc.lat ?? loc.latitude ?? row?.lat ?? row?.latitude);
      const lon = Number(loc.long ?? loc.lon ?? loc.longitude ?? row?.long ?? row?.lon ?? row?.longitude);
      const timestamp = Number(row?.ob?.timestamp ?? row?.timestamp ?? row?.dateTimeEpoch ?? 0);
      const type = row?.ob?.pulseType || row?.ob?.type || row?.type || '';
      const polarity = row?.ob?.polarity ?? row?.polarity;
      const amperage = row?.ob?.amperage ?? row?.ob?.peakAmp ?? row?.amperage;
      return { lat, lon, timestamp, type, polarity, amperage };
    }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon));
  }

  function ensureMetric() {
    if (metric || !document.getElementById('mapScreen')) return;
    metric = document.createElement('div');
    metric.className = 'premium-lightning-metric';
    metric.hidden = true;
    document.getElementById('mapScreen').appendChild(metric);
  }

  function clearLightning() {
    if (group) { group.remove(); group = null; }
    if (rings) { rings.remove(); rings = null; }
    if (metric) metric.hidden = true;
  }

  function drawRings(loc) {
    if (!map || !loc || selectedLayer !== 'lightning') return;
    if (rings) rings.remove();
    rings = L.layerGroup().addTo(map);
    [10,25,50,100].forEach(radius => {
      L.circle([loc.latitude, loc.longitude], {
        radius:radius*1000,
        color:'rgba(170,195,220,.30)',
        weight:1,
        fill:false,
        interactive:false
      }).bindTooltip(`${radius} km`, { permanent:false, direction:'center', className:'premium-ring-tooltip' }).addTo(rings);
    });
  }

  function draw(strikes, loc) {
    if (!map || selectedLayer !== 'lightning') return;
    if (group) group.remove();
    group = L.layerGroup().addTo(map);
    const now = Date.now()/1000;
    strikes.forEach(strike => {
      const age = strike.timestamp ? Math.max(0, now - strike.timestamp) : 0;
      const opacity = Math.max(.25, 1 - age / 360);
      const marker = L.circleMarker([strike.lat,strike.lon], {
        radius:3.6,
        color:'#f3f6ff',
        weight:1,
        fillColor:'#ffd85c',
        fillOpacity:opacity,
        opacity:Math.min(1,opacity+.15),
        pane:'markerPane'
      });
      const detail = [
        strike.type ? `Type: ${strike.type}` : '',
        strike.polarity != null ? `Polarity: ${strike.polarity}` : '',
        strike.amperage != null ? `Current: ${strike.amperage}` : ''
      ].filter(Boolean).join('<br>');
      if (detail) marker.bindPopup(`<strong>Lightning detection</strong><br>${detail}`);
      marker.addTo(group);
    });

    const distances = strikes.map(s => distanceKm(Number(loc.latitude),Number(loc.longitude),s.lat,s.lon)).sort((a,b)=>a-b);
    const within25 = distances.filter(d=>d<=25).length;
    const closest = distances[0];
    ensureMetric();
    if (metric) {
      metric.hidden = false;
      metric.innerHTML = `<span><b class="premium-lightning-pulse"></b>EXACT LIGHTNING</span><strong>${closest == null ? 'No strikes nearby' : `${closest.toFixed(1)} km closest`}</strong><small>${within25} detection${within25===1?'':'s'} within 25 km · Vaisala/Xweather</small>`;
    }
  }

  async function refresh() {
    const loc = location();
    if (!providerEnabled || selectedLayer !== 'lightning' || !map || !loc) return clearLightning();
    try {
      const response = await fetch(`/api/xweather-lightning?lat=${encodeURIComponent(loc.latitude)}&lon=${encodeURIComponent(loc.longitude)}&radius=100&limit=1000`, { cache:'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      draw(extractStrikes(data), loc);
      drawRings(loc);
    } catch (error) {
      console.warn('[StormLens exact lightning]', error);
    }
  }

  async function activate(targetMap) {
    map = targetMap;
    const providers = await providerStatus();
    providerEnabled = Boolean(providers.xweather);
    selectedLayer = window.StormLensMapV6?.selectedLayer || null;
    clearInterval(timer);
    timer = setInterval(refresh, 60000);
    refresh();
  }

  window.addEventListener('stormlens:weather-layer-changed', event => {
    selectedLayer = event.detail?.id || null;
    if (selectedLayer !== 'lightning') clearLightning();
    else refresh();
  });
  window.addEventListener('stormlens:map-ready', event => activate(event.detail.map));
  if (window.StormLensMap) activate(window.StormLensMap);
})();
