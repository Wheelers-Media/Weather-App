(() => {
  if (!window.L) return;

  const WMS = 'https://geo.weather.gc.ca/geomet?';
  const STORAGE = 'stormlens-map-v6';
  const THEME_STORAGE = 'stormlens-theme-v6';
  const MAP_STYLE_STORAGE = 'stormlens-basemap-v6';
  const WEATHER_STORAGE = 'stormlens-weather-layer-v6';
  const originalWms = window.StormLensOriginalWms || L.tileLayer.wms;

  const defs = {
    radar: { title:'Radar', category:'Precipitation', icon:'radar', layer:'RADAR_1KM_RRAI', style:'RADARURPPRECIPR14-LINEAR', kind:'observed', opacity:.82, description:'Official 1 km observed radar.' },
    nowcast: { title:'Radar nowcast', category:'Precipitation', icon:'cloud-rain-wind', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR', kind:'nowcast', opacity:.78, description:'Short-range extrapolation of observed precipitation.' },
    precipType: { title:'Precipitation type', category:'Precipitation', icon:'cloud-snow', layer:'Radar_1km_SfcPrecipType', kind:'observed', opacity:.78, description:'Observed rain, snow and mixed precipitation.' },
    futurePrecip: { title:'Forecast precipitation', category:'Precipitation', icon:'clock-3', layer:'HRDPS.CONTINENTAL_RT', kind:'forecast', opacity:.72, description:'HRDPS forecast precipitation rate.' },
    precipProb: { title:'Precipitation probability', category:'Precipitation', icon:'percent', layer:'HRDPS-WEonG_2.5km_Precip-Prob', kind:'forecast', opacity:.64, description:'Probability of precipitation.' },
    rainAccum: { title:'Rain accumulation', category:'Precipitation', icon:'droplets', layer:'HRDPS.CONTINENTAL_RN', kind:'forecast', opacity:.68, description:'Forecast accumulated rain.' },

    satellite: { title:'Weather satellite', category:'Satellite', icon:'satellite', layer:'GOES-West_1km_DayVis-NightIR', kind:'observed', opacity:.82, noLegend:true, description:'GOES-West day visible and night infrared imagery.' },
    satelliteStorm: { title:'Storm satellite IR', category:'Satellite', icon:'cloud-lightning', layer:'GOES-West_1km_VisibleIRSandwich-NightMicrophysicsIR', kind:'observed', opacity:.84, noLegend:true, description:'Storm-focused visible and infrared satellite.' },

    lightning: { title:'Lightning density', category:'Storms', icon:'zap', layer:'Lightning_2.5km_Density', kind:'observed', opacity:.86, description:'Canadian lightning flash-density analysis.' },
    thunderRisk: { title:'Thunderstorm probability', category:'Storms', icon:'cloud-lightning', layer:'HRDPS-WEonG_2.5km_Thunderstorm-Prob', kind:'forecast', opacity:.68, description:'High-resolution thunderstorm probability guidance.' },
    showalter: { title:'Showalter index', category:'Storms', icon:'activity', layer:'HRDPS.CONTINENTAL.CONV_SHWINX.500', kind:'forecast', opacity:.64, description:'Convective instability diagnostic.' },
    alerts: { title:'Official alerts', category:'Storms', icon:'triangle-alert', layer:'Current-Alerts', style:'Current-Alerts', kind:'current', opacity:.94, description:'Environment Canada watches, warnings and advisories.' },

    temperature: { title:'Temperature', category:'Atmosphere', icon:'thermometer', layer:'HRDPS.CONTINENTAL_TT', kind:'forecast', opacity:.66, description:'2 m air temperature forecast.' },
    dewpoint: { title:'Dew point', category:'Atmosphere', icon:'droplet', layer:'HRDPS.CONTINENTAL_TD', kind:'forecast', opacity:.64, description:'Dew point temperature.' },
    humidity: { title:'Humidity', category:'Atmosphere', icon:'waves', layer:'HRDPS.CONTINENTAL_HR', kind:'forecast', opacity:.62, description:'Near-surface relative humidity.' },
    pressure: { title:'Sea-level pressure', category:'Atmosphere', icon:'gauge', layer:'HRDPS.CONTINENTAL_PN-SLP', kind:'forecast', opacity:.58, description:'Sea-level pressure field.' },
    clouds: { title:'Cloud cover', category:'Atmosphere', icon:'cloud', layer:'HRDPS.CONTINENTAL_NT', kind:'forecast', opacity:.62, description:'Total cloud cover forecast.' },

    windSpeed: { title:'Wind speed', category:'Wind', icon:'wind', layer:'HRDPS.CONTINENTAL_WSPD', kind:'forecast', opacity:.66, description:'Near-surface wind speed.' },
    windGust: { title:'Wind gusts', category:'Wind', icon:'wind', layer:'HRDPS.CONTINENTAL_WGE', kind:'forecast', opacity:.66, description:'Forecast wind gusts.' },

    snowAccum: { title:'Snow accumulation', category:'Winter', icon:'snowflake', layer:'HRDPS.CONTINENTAL_SN', kind:'forecast', opacity:.70, description:'Forecast accumulated snowfall.' },
    snowDepth: { title:'Snow depth', category:'Winter', icon:'ruler', layer:'HRDPS.CONTINENTAL_SD', kind:'forecast', opacity:.66, description:'Forecast snow depth.' },
    freezingRain: { title:'Freezing rain', category:'Winter', icon:'cloud-hail', layer:'HRDPS.CONTINENTAL_FR', kind:'forecast', opacity:.72, description:'Forecast freezing-rain accumulation.' },
    modelPrecipType: { title:'Forecast precip type', category:'Winter', icon:'cloud-snow', layer:'HRDPS.CONTINENTAL.DIAG_PTYPE', kind:'forecast', opacity:.70, description:'Model instantaneous precipitation type.' },

    aqhi: { title:'Air Quality Health Index', category:'Environment', icon:'lungs', layer:'AQHI-OBS', kind:'current', opacity:.74, description:'Official Canadian AQHI observations.' },
    smoke: { title:'Wildfire smoke PM2.5', category:'Environment', icon:'cloud-fog', layer:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', kind:'forecast', opacity:.68, description:'Canadian wildfire-smoke PM2.5 plume forecast.' }
  };

  const baseDefs = {
    auto: { title:'Auto', subtitle:'Follows app theme', type:'auto', preview:'auto' },
    standard: { title:'Standard', subtitle:'Roads + labels', url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution:'© OpenStreetMap © CARTO', preview:'standard' },
    light: { title:'Light', subtitle:'Bright + clean', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution:'© OpenStreetMap © CARTO', preview:'light' },
    dark: { title:'Dark', subtitle:'Low-light radar', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution:'© OpenStreetMap © CARTO', preview:'dark' },
    satellite: { title:'Satellite', subtitle:'Aerial imagery', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution:'Tiles © Esri', preview:'satellite' },
    terrain: { title:'Terrain', subtitle:'Topo + terrain', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution:'Tiles © Esri', preview:'terrain' }
  };

  let map = null;
  let baseLayer = null;
  let baseLabels = null;
  let selectedWeather = localStorage.getItem(WEATHER_STORAGE) || 'radar';
  if (!defs[selectedWeather]) selectedWeather = 'radar';
  let baseStyle = localStorage.getItem(MAP_STYLE_STORAGE) || 'auto';
  if (!baseDefs[baseStyle]) baseStyle = 'auto';
  let themeChoice = localStorage.getItem(THEME_STORAGE) || 'system';
  if (!['system','dark','light'].includes(themeChoice)) themeChoice = 'system';

  let metaCache = new Map();
  let frameCache = new Map();
  let frameTimes = [];
  let frameIndex = 0;
  let currentFrameKey = null;
  let playbackTimer = null;
  let playing = false;
  let selectionToken = 0;
  let sheetBuilt = false;
  let exactLayerStatus = 'idle';

  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizedTime = date => new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');

  function getSettings() {
    try { return JSON.parse(localStorage.getItem('stormlens-settings') || '{}'); }
    catch (_) { return {}; }
  }

  function effectiveTheme() {
    if (themeChoice === 'dark' || themeChoice === 'light') return themeChoice;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme() {
    const resolved = effectiveTheme();
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeChoice = themeChoice;
    document.body.dataset.theme = resolved;
    const app = $('#app'); if (app) app.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'light' ? '#f5f7fa' : '#070b12';
    const select = $('#stormlensThemeSelect'); if (select) select.value = themeChoice;
    if (baseStyle === 'auto' && map) setBaseMap('auto', false);
  }

  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (themeChoice === 'system') applyTheme();
  });

  function resolveBaseStyle(style) {
    return style === 'auto' ? (effectiveTheme() === 'light' ? 'light' : 'dark') : style;
  }

  function removeBaseLayers() {
    if (!map) return;
    if (baseLayer && map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
    if (baseLabels && map.hasLayer(baseLabels)) map.removeLayer(baseLabels);
    baseLayer = null; baseLabels = null;
  }

  function setBaseMap(style, persist = true) {
    if (!map || !baseDefs[style]) return;
    baseStyle = style;
    if (persist) localStorage.setItem(MAP_STYLE_STORAGE, style);
    removeBaseLayers();
    const resolved = resolveBaseStyle(style);
    const def = baseDefs[resolved];
    baseLayer = L.tileLayer(def.url, { maxZoom:19, attribution:def.attribution, updateWhenIdle:false, keepBuffer:3 }).addTo(map);
    baseLayer._stormlensBaseV6 = true;
    baseLayer.bringToBack();
    if (resolved === 'satellite') {
      baseLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom:19, opacity:.82, attribution:'Labels © Esri', pane:'overlayPane'
      }).addTo(map);
      baseLabels._stormlensBaseV6 = true;
      baseLabels.setZIndex(220);
    }
    $$('.map-type-card').forEach(card => card.classList.toggle('active', card.dataset.mapStyle === baseStyle));
    const setting = $('#stormlensMapStyleSelect'); if (setting) setting.value = baseStyle;
  }

  function cleanLegacyMapLayers() {
    if (!map) return;
    const remove = [];
    map.eachLayer(layer => {
      if (layer._stormlensBaseV6 || layer._stormlensWeatherV6) return;
      if (layer._stormlensProvider === 'rainviewer-fallback') remove.push(layer);
      else if (layer.wmsParams?.layers) remove.push(layer);
      else if (layer._url && /basemaps\.cartocdn\.com|server\.arcgisonline\.com/.test(layer._url)) remove.push(layer);
    });
    remove.forEach(layer => { try { map.removeLayer(layer); } catch (_) {} });
  }

  function parseDuration(value) {
    const m = String(value || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 360000;
    return (((Number(m[1]||0)*24 + Number(m[2]||0))*60 + Number(m[3]||0))*60 + Number(m[4]||0))*1000 || 360000;
  }

  function parseTimes(text) {
    if (!text) return [];
    const output = [];
    for (const part of String(text).split(',').map(v => v.trim()).filter(Boolean)) {
      if (!part.includes('/')) {
        const d = new Date(part); if (!Number.isNaN(d.getTime())) output.push(d);
        continue;
      }
      const [startRaw,endRaw,periodRaw] = part.split('/');
      const start = new Date(startRaw), end = new Date(endRaw), step = parseDuration(periodRaw);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || step <= 0) continue;
      for (let t=start.getTime(), guard=0; t<=end.getTime() && guard<2500; t+=step,guard++) output.push(new Date(t));
    }
    return [...new Map(output.map(d => [d.toISOString(),d])).values()].sort((a,b)=>a-b);
  }

  function directChild(node, name) {
    return [...(node?.children || [])].find(child => child.localName === name || child.tagName === name);
  }

  async function getMeta(id) {
    if (metaCache.has(id)) return metaCache.get(id);
    const def = defs[id];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetCapabilities', layer:def.layer, _:String(Date.now()) });
      const res = await fetch(`${WMS}${params}`, { cache:'no-store', signal:controller.signal });
      if (!res.ok) throw new Error(`GeoMet ${res.status}`);
      const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('Invalid GeoMet response');
      const node = [...xml.querySelectorAll('Layer')].find(n => directChild(n,'Name')?.textContent?.trim() === def.layer);
      if (!node) throw new Error('Layer not published');
      const timeNode = [...node.children].find(child => (child.localName === 'Dimension' || child.localName === 'Extent') && child.getAttribute('name') === 'time');
      const styles = [...node.children].filter(child => child.localName === 'Style').map(s => directChild(s,'Name')?.textContent?.trim()).filter(Boolean);
      const meta = { valid:true, times:parseTimes(timeNode?.textContent?.trim() || ''), styles };
      metaCache.set(id, meta); return meta;
    } catch (error) {
      return { valid:false, times:[], styles:[], error:error.name === 'AbortError' ? 'Timed out' : error.message };
    } finally { clearTimeout(timeout); }
  }

  function preferredIndex(def, times) {
    if (!times.length) return 0;
    const now = Date.now();
    if (def.kind === 'observed') {
      let best = 0;
      times.forEach((d,i) => { if (d.getTime() <= now + 2*60000) best = i; });
      return best;
    }
    let best = 0, delta = Infinity;
    times.forEach((d,i) => { const x=Math.abs(d.getTime()-now); if (x<delta) {delta=x;best=i;} });
    return best;
  }

  function layerOpacity() {
    const setting = Number(getSettings().radarOpacity);
    if (Number.isFinite(setting)) return Math.max(.2, Math.min(1, setting/100));
    return defs[selectedWeather]?.opacity || .78;
  }

  function frameKey(id,index) { return `${id}:${index}`; }

  function removeFrame(key) {
    const item = frameCache.get(key);
    if (!item) return;
    if (item.layer && map?.hasLayer(item.layer)) map.removeLayer(item.layer);
    frameCache.delete(key);
    if (currentFrameKey === key) currentFrameKey = null;
  }

  function clearFrames() {
    [...frameCache.keys()].forEach(removeFrame);
    frameCache.clear(); currentFrameKey = null;
  }

  function makeFrameLayer(id,index) {
    const def = defs[id];
    const meta = metaCache.get(id) || { styles:[] };
    const chosenStyle = def.style && (!meta.styles.length || meta.styles.includes(def.style)) ? def.style : '';
    const params = {
      layers:def.layer,
      styles:chosenStyle,
      format:'image/png',
      transparent:true,
      version:'1.3.0',
      opacity:0,
      zIndex:450,
      keepBuffer:2,
      updateWhenIdle:true
    };
    if (frameTimes.length) params.time = normalizedTime(frameTimes[index]);
    const layer = originalWms(WMS, params);
    layer._stormlensWeatherV6 = true;
    layer._stormlensWeatherId = id;
    layer._stormlensFrameIndex = index;
    const item = { layer, ready:false, errors:0, loads:0, created:Date.now(), promise:null, resolve:null };
    item.promise = new Promise(resolve => item.resolve = resolve);
    layer.on('tileload', () => { item.loads += 1; });
    layer.on('load', () => { item.ready = true; item.resolve?.(true); item.resolve=null; if (id===selectedWeather) setLayerLive(true); });
    layer.on('tileerror', () => {
      item.errors += 1;
      if (item.errors >= 6 && item.loads === 0) {
        item.resolve?.(false); item.resolve=null;
        if (id===selectedWeather) setLayerLive(false, 'Weather layer unavailable');
      }
    });
    layer.addTo(map);
    return item;
  }

  function ensureFrame(index) {
    if (!map || index < 0 || index >= Math.max(1,frameTimes.length)) return null;
    const key = frameKey(selectedWeather,index);
    if (frameCache.has(key)) return frameCache.get(key);
    const item = makeFrameLayer(selectedWeather,index);
    frameCache.set(key,item);
    return item;
  }

  async function waitReady(item, timeoutMs=1900) {
    if (!item) return false;
    if (item.ready) return true;
    return Promise.race([item.promise, new Promise(resolve => setTimeout(()=>resolve(item.ready),timeoutMs))]);
  }

  function trimFrames(center) {
    const keep = new Set();
    for (let i=center-3;i<=center+5;i++) if (i>=0 && i<Math.max(1,frameTimes.length)) keep.add(frameKey(selectedWeather,i));
    frameCache.forEach((item,key) => {
      if (!key.startsWith(`${selectedWeather}:`) || !keep.has(key)) removeFrame(key);
    });
  }

  function prefetch(index) {
    [index-1,index+1,index+2,index+3,index+4].forEach(i => {
      if (i>=0 && i<Math.max(1,frameTimes.length)) ensureFrame(i);
    });
    setTimeout(() => trimFrames(index), 500);
  }

  function updateTimeUI(index, previewOnly=false) {
    const def = defs[selectedWeather];
    const stamp = $('#radarTimestamp');
    const mode = $('#radarModeLabel');
    const start = $('#timelineStartLabel');
    const end = $('#timelineNowLabel');
    const range = $('#radarTimeline');
    const date = frameTimes[index];
    if (range) range.value = String(index);
    if (mode) mode.textContent = def.kind === 'forecast' ? 'FORECAST' : def.kind === 'nowcast' ? 'NOWCAST' : def.kind === 'current' ? 'CURRENT' : 'OBSERVED';
    if (!date) {
      if (stamp) stamp.textContent = 'Latest available';
      if (start) start.textContent = 'CURRENT';
      if (end) end.textContent = '';
      return;
    }
    if (stamp) stamp.textContent = date.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    const delta = Math.round((date.getTime()-Date.now())/60000);
    if (start) start.textContent = def.kind === 'forecast' || def.kind === 'nowcast' ? 'NOW' : 'HISTORY';
    if (end) end.textContent = Math.abs(delta)<8 ? 'NOW' : delta < 0 ? `${Math.abs(delta)}M AGO` : delta < 60 ? `+${delta}M` : `+${(delta/60).toFixed(delta%60?1:0)}H`;
    if (!previewOnly) updateLegend();
  }

  async function showFrame(index, options={}) {
    if (!map) return false;
    index = Math.max(0, Math.min(Math.max(0,frameTimes.length-1), index));
    const token = selectionToken;
    const item = ensureFrame(index);
    if (!item) return false;
    if (!item.ready) {
      if (!options.quiet) setStatus(`${defs[selectedWeather].title} · loading`,'loading');
      await waitReady(item, options.animation ? 1200 : 2200);
    }
    if (token !== selectionToken) return false;
    const key = frameKey(selectedWeather,index);
    if (currentFrameKey && currentFrameKey !== key) {
      const current = frameCache.get(currentFrameKey);
      current?.layer?.setOpacity(0);
    }
    item.layer.setOpacity(layerOpacity());
    currentFrameKey = key;
    frameIndex = index;
    updateTimeUI(index);
    setLayerLive(item.ready || item.loads>0);
    prefetch(index);
    return true;
  }

  function setStatus(text,state='live') {
    const label = $('#mapLayerStatus'); if (label) label.textContent = text;
    const pill = $('#mapStatusPill'); if (pill) { pill.dataset.state = state; pill.dataset.error = state==='error'?'true':'false'; }
  }

  function setLayerLive(live, message) {
    exactLayerStatus = live ? 'live' : 'error';
    setStatus(message || `${defs[selectedWeather].title} · ${live ? 'LIVE' : 'unavailable'}`, live ? 'live':'error');
    renderSheetSelection();
  }

  function legendUrl(def) {
    const p = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetLegendGraphic', sld_version:'1.1.0', layer:def.layer, format:'image/png' });
    if (def.style) p.set('STYLE',def.style);
    return `${WMS}${p}`;
  }

  function updateLegend() {
    const def = defs[selectedWeather];
    const legend = $('#radarLegend');
    const source = $('#radarSourceLine');
    if (!legend || !def) return;
    if (selectedWeather === 'radar' || selectedWeather === 'nowcast') {
      legend.innerHTML = '<span><b class="legend-dot v6-l1"></b>Light</span><span><b class="legend-dot v6-l2"></b>Moderate</span><span><b class="legend-dot v6-l3"></b>Heavy</span><span><b class="legend-dot v6-l4"></b>Very heavy</span><span><b class="legend-dot v6-l5"></b>Extreme</span>';
    } else if (def.noLegend) {
      legend.innerHTML = `<span class="v6-legend-note">${esc(def.title)}</span>`;
    } else {
      legend.innerHTML = `<span class="v6-legend-name">${esc(def.title)}</span><img class="v6-wms-legend" src="${esc(legendUrl(def))}" alt="${esc(def.title)} legend"/>`;
    }
    if (source) source.textContent = `${def.title} · ${def.kind === 'forecast' ? 'forecast guidance' : def.kind === 'nowcast' ? 'short-range nowcast' : 'observed/current data'} · ECCC GeoMet`;
  }

  function configureTimeline() {
    const range=$('#radarTimeline'), back=$('#radarStepBack'), forward=$('#radarStepForward'), play=$('#radarPlay');
    const max=Math.max(0,frameTimes.length-1);
    if (range) { range.min='0'; range.max=String(max); range.step='1'; range.value=String(frameIndex); range.disabled=frameTimes.length<2; }
    [back,forward,play].forEach(btn => { if(btn) btn.disabled=frameTimes.length<2; });
  }

  async function selectWeatherLayer(id, options={}) {
    if (!defs[id] || !map) return;
    stopPlayback();
    selectionToken += 1;
    const token = selectionToken;
    selectedWeather = id;
    localStorage.setItem(WEATHER_STORAGE,id);
    clearFrames();
    frameTimes=[]; frameIndex=0; currentFrameKey=null; exactLayerStatus='loading';
    setStatus(`${defs[id].title} · connecting`,'loading');
    syncQuickButtons();
    renderSheetSelection();
    updateLegend();
    const meta = await getMeta(id);
    if (token !== selectionToken) return;
    if (!meta.valid) {
      setLayerLive(false, `${defs[id].title} · unavailable`);
      return;
    }
    metaCache.set(id,meta);
    frameTimes = meta.times;
    frameIndex = preferredIndex(defs[id],frameTimes);
    configureTimeline();
    updateTimeUI(frameIndex,true);
    await showFrame(frameIndex);
    if (token !== selectionToken) return;
    prefetch(frameIndex);
    window.dispatchEvent(new CustomEvent('stormlens:weather-layer-changed',{detail:{id,def:defs[id]}}));
    if (!options.quiet) closeLayers();
  }

  function syncQuickButtons() {
    const mapping={radar:'radar',nowcast:'nowcast',lightning:'lightning',storms:'thunderRisk',alerts:'alerts'};
    Object.entries(mapping).forEach(([quick,id]) => {
      const button=$(`#quickLayers [data-layer="${quick}"]`);
      if (button) button.classList.toggle('active', selectedWeather===id);
    });
  }

  function stopPlayback() {
    playing=false;
    if (playbackTimer) clearTimeout(playbackTimer);
    playbackTimer=null;
    const btn=$('#radarPlay'); if(btn) btn.innerHTML='<i data-lucide="play"></i>';
    refreshIcons();
  }

  function playbackSpeed() {
    const value=Number(getSettings().radarSpeed || 650);
    return Math.max(260, value);
  }

  async function bufferForPlayback(start) {
    setStatus(`${defs[selectedWeather].title} · buffering`,'loading');
    const items=[];
    for(let i=start;i<=Math.min(frameTimes.length-1,start+4);i++) items.push(ensureFrame(i));
    await Promise.race([
      Promise.all(items.filter(Boolean).map(item=>waitReady(item,1600))),
      new Promise(resolve=>setTimeout(resolve,1700))
    ]);
  }

  async function playTick() {
    if (!playing || frameTimes.length<2) return;
    let next=frameIndex+1;
    if (next>=frameTimes.length) {
      if (defs[selectedWeather].kind==='observed') next=Math.max(0,frameTimes.length-11);
      else next=preferredIndex(defs[selectedWeather],frameTimes);
    }
    await showFrame(next,{animation:true,quiet:true});
    if (!playing) return;
    playbackTimer=setTimeout(playTick,playbackSpeed());
  }

  async function togglePlayback() {
    if (playing) return stopPlayback();
    if (frameTimes.length<2) return;
    if (frameIndex>=frameTimes.length-1) {
      frameIndex = defs[selectedWeather].kind==='observed' ? Math.max(0,frameTimes.length-11) : preferredIndex(defs[selectedWeather],frameTimes);
      await showFrame(frameIndex,{quiet:true});
    }
    playing=true;
    const btn=$('#radarPlay'); if(btn) btn.innerHTML='<i data-lucide="pause"></i>';
    refreshIcons();
    await bufferForPlayback(frameIndex);
    if (!playing) return;
    setLayerLive(true);
    playTick();
  }

  let scrubTimer=null;
  function bindTimeline() {
    const range=$('#radarTimeline'), back=$('#radarStepBack'), forward=$('#radarStepForward'), play=$('#radarPlay');
    if (!range || range.dataset.v6Bound) return;
    range.dataset.v6Bound='true';
    range.addEventListener('input',event=>{
      event.stopImmediatePropagation(); stopPlayback();
      const index=Number(range.value); updateTimeUI(index,true);
      clearTimeout(scrubTimer); scrubTimer=setTimeout(()=>showFrame(index,{quiet:true}),100);
    },true);
    range.addEventListener('change',event=>{event.stopImmediatePropagation();clearTimeout(scrubTimer);showFrame(Number(range.value));},true);
    back?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();stopPlayback();showFrame(Math.max(0,frameIndex-1));},true);
    forward?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();stopPlayback();showFrame(Math.min(frameTimes.length-1,frameIndex+1));},true);
    play?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();togglePlayback();},true);
  }

  function bindQuickRail() {
    const rail=$('#quickLayers'); if(!rail || rail.dataset.v6Bound) return;
    rail.dataset.v6Bound='true';
    rail.addEventListener('click',event=>{
      const button=event.target.closest('[data-layer]'); if(!button) return;
      const key=button.dataset.layer;
      if(!['radar','nowcast','lightning','storms','alerts','layers'].includes(key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if(key==='layers') return openLayers();
      const id={radar:'radar',nowcast:'nowcast',lightning:'lightning',storms:'thunderRisk',alerts:'alerts'}[key];
      selectWeatherLayer(id);
    },true);
  }

  function weatherGroupsHTML() {
    const categories=['Precipitation','Storms','Satellite','Atmosphere','Wind','Winter','Environment'];
    return categories.map(category=>{
      const rows=Object.entries(defs).filter(([,def])=>def.category===category).map(([id,def])=>`
        <button class="v6-layer-row ${selectedWeather===id?'active':''}" data-v6-weather="${id}">
          <span class="v6-layer-icon"><i data-lucide="${def.icon}"></i></span>
          <span class="v6-layer-copy"><strong>${esc(def.title)}</strong><small>${esc(def.description)}</small></span>
          <span class="v6-radio"><b></b></span>
        </button>`).join('');
      return `<section class="v6-layer-group"><h3>${category}</h3>${rows}</section>`;
    }).join('');
  }

  function baseCardsHTML() {
    return Object.entries(baseDefs).map(([id,def])=>`
      <button class="map-type-card ${baseStyle===id?'active':''}" data-map-style="${id}">
        <span class="map-type-preview preview-${def.preview}"></span>
        <strong>${def.title}</strong><small>${def.subtitle}</small>
      </button>`).join('');
  }

  function buildLayerSheet() {
    const sheet=$('#layersModal .layer-sheet'); if(!sheet || sheetBuilt) return;
    sheetBuilt=true;
    sheet.innerHTML=`
      <div class="sheet-handle"></div>
      <div class="sheet-title-row"><div><span class="eyebrow">MAP</span><h2>Map layers</h2></div><button class="icon-button v6-close-layers" aria-label="Close"><i data-lucide="x"></i></button></div>
      <section class="v6-map-type-section"><div class="v6-section-head"><div><span class="eyebrow">BASE MAP</span><h3>Map type</h3></div><small>Choose the map underneath weather</small></div><div class="map-type-grid">${baseCardsHTML()}</div></section>
      <section class="v6-weather-section"><div class="v6-section-head"><div><span class="eyebrow">WEATHER</span><h3>Weather layer</h3></div><small>One active layer at a time</small></div><div class="v6-selected-summary"><span class="health-dot ${exactLayerStatus==='live'?'live':exactLayerStatus==='error'?'error':'loading'}"></span><strong id="v6SelectedLayerName">${esc(defs[selectedWeather].title)}</strong><span>selected</span></div><div class="v6-layer-groups">${weatherGroupsHTML()}</div></section>`;
    sheet.querySelector('.v6-close-layers')?.addEventListener('click',closeLayers);
    sheet.querySelectorAll('[data-map-style]').forEach(btn=>btn.addEventListener('click',()=>setBaseMap(btn.dataset.mapStyle)));
    sheet.querySelectorAll('[data-v6-weather]').forEach(btn=>btn.addEventListener('click',()=>selectWeatherLayer(btn.dataset.v6Weather)));
    refreshIcons();
  }

  function renderSheetSelection() {
    if(!sheetBuilt) return;
    $$('[data-v6-weather]').forEach(row=>row.classList.toggle('active',row.dataset.v6Weather===selectedWeather));
    $$('.map-type-card').forEach(card=>card.classList.toggle('active',card.dataset.mapStyle===baseStyle));
    const name=$('#v6SelectedLayerName'); if(name) name.textContent=defs[selectedWeather].title;
    const summary=$('.v6-selected-summary .health-dot'); if(summary) summary.className=`health-dot ${exactLayerStatus==='live'?'live':exactLayerStatus==='error'?'error':'loading'}`;
  }

  function openLayers() { buildLayerSheet(); const modal=$('#layersModal'); if(modal) modal.hidden=false; renderSheetSelection(); refreshIcons(); }
  function closeLayers() { const modal=$('#layersModal'); if(modal) modal.hidden=true; }

  function injectSettings() {
    const list=$('#settingsModal .settings-list'); if(!list || $('#stormlensThemeSelect')) return;
    const theme=document.createElement('div'); theme.className='setting-row';
    theme.innerHTML='<span><strong>Appearance</strong><small>App theme</small></span><select id="stormlensThemeSelect"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select>';
    const mapSetting=document.createElement('div'); mapSetting.className='setting-row';
    mapSetting.innerHTML='<span><strong>Default map</strong><small>Basemap under weather</small></span><select id="stormlensMapStyleSelect"><option value="auto">Auto</option><option value="standard">Standard</option><option value="light">Light</option><option value="dark">Dark</option><option value="satellite">Satellite</option><option value="terrain">Terrain</option></select>';
    list.insertBefore(mapSetting,list.firstChild?.nextSibling || list.firstChild);
    list.insertBefore(theme,list.firstChild?.nextSibling || list.firstChild);
    $('#stormlensThemeSelect').value=themeChoice;
    $('#stormlensMapStyleSelect').value=baseStyle;
    $('#stormlensThemeSelect').addEventListener('change',event=>{themeChoice=event.target.value;localStorage.setItem(THEME_STORAGE,themeChoice);applyTheme();});
    $('#stormlensMapStyleSelect').addEventListener('change',event=>setBaseMap(event.target.value));
    $('#radarOpacity')?.addEventListener('input',()=>{
      const item=currentFrameKey?frameCache.get(currentFrameKey):null; if(item) item.layer.setOpacity(layerOpacity());
    });
  }

  function refreshIcons(){ if(window.lucide) requestAnimationFrame(()=>window.lucide.createIcons()); }

  function initialize(targetMap) {
    if (map) return;
    map=targetMap;
    cleanLegacyMapLayers();
    setBaseMap(baseStyle,false);
    buildLayerSheet();
    injectSettings();
    bindTimeline();
    bindQuickRail();
    syncQuickButtons();
    selectWeatherLayer(selectedWeather,{quiet:true});
  }

  window.StormLensMapV6={
    defs,
    get map(){return map;},
    get selectedLayer(){return selectedWeather;},
    selectLayer:selectWeatherLayer,
    setBaseMap,
    setTheme(choice){themeChoice=choice;localStorage.setItem(THEME_STORAGE,choice);applyTheme();},
    openLayers,
    stopPlayback
  };
  window.StormLensPremiumOverlays={
    get map(){return map;},
    selectLayer:selectWeatherLayer,
    toggleLayer(id,force){ if(force===false && selectedWeather===id) return; return selectWeatherLayer(id); },
    applyPreset(name){ return selectWeatherLayer(name==='storm'?'thunderRisk':name==='winter'?'snowAccum':name==='smoke'?'smoke':'radar'); }
  };

  applyTheme();
  injectSettings();
  buildLayerSheet();
  bindQuickRail();
  bindTimeline();
  window.addEventListener('stormlens:map-ready',event=>initialize(event.detail.map));
  if(window.StormLensMap) setTimeout(()=>initialize(window.StormLensMap),0);
})();
