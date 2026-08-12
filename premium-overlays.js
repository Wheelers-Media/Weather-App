(() => {
  if (!window.L) return;

  const WMS = 'https://geo.weather.gc.ca/geomet?';
  const STORAGE_KEY = 'stormlens-premium-map-v5';
  const defaultState = { active: ['radar'], opacities: {}, preset: 'radar', mapStyle: 'dark' };
  let saved;
  try { saved = Object.assign({}, defaultState, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch (_) { saved = { ...defaultState }; }

  const defs = {
    radar: {
      title: 'Classic radar', category: 'Precipitation', icon: 'radar', source: 'ECCC GeoMet',
      layer: 'RADAR_1KM_RRAI', style: 'RADARURPPRECIPR14-LINEAR', kind: 'observed', opacity: .84, z: 470,
      description: 'Official 1 km observed rain radar with classic green, yellow, red and magenta intensity colors.'
    },
    nowcast: {
      title: 'Radar nowcast', category: 'Precipitation', icon: 'cloud-rain-wind', source: 'ECCC GeoMet',
      layer: 'Radar_1km_RainPrecipRate-Extrapolation', style: 'RADARURPPRECIPR14-LINEAR', kind: 'nowcast', opacity: .72, z: 465,
      description: 'Short-range extrapolation of observed radar. This is nowcast guidance, not live radar.'
    },
    precipType: {
      title: 'Precipitation type', category: 'Precipitation', icon: 'cloud-snow', source: 'ECCC GeoMet',
      layer: 'Radar_1km_SfcPrecipType', kind: 'observed', opacity: .72, z: 460,
      description: 'Observed precipitation type including rain, snow and mixed precipitation.'
    },
    futurePrecip: {
      title: 'Forecast precipitation', category: 'Precipitation', icon: 'clock-3', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_RT', kind: 'forecast', opacity: .68, z: 410,
      description: '2.5 km model precipitation rate through the short-range forecast. Clearly separated from observed radar.'
    },
    precipProb: {
      title: 'Precipitation probability', category: 'Precipitation', icon: 'percent', source: 'ECCC HRDPS WEonG',
      layer: 'HRDPS-WEonG_2.5km_Precip-Prob', kind: 'forecast', opacity: .58, z: 405,
      description: 'Probability of precipitation from Canadian post-processed forecast guidance.'
    },
    rainAccum: {
      title: 'Rain accumulation', category: 'Precipitation', icon: 'droplets', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_RN', kind: 'forecast', opacity: .62, z: 400,
      description: 'Model rain accumulation for the selected forecast time.'
    },
    satellite: {
      title: 'Satellite day / night', category: 'Satellite', icon: 'satellite', source: 'ECCC GOES-West',
      layer: 'GOES-West_1km_DayVis-NightIR', kind: 'observed', opacity: .66, z: 315, noLegend: true,
      description: 'GOES-West day visibility with night infrared, updated every 10 minutes.'
    },
    satelliteStorm: {
      title: 'Satellite storm IR', category: 'Satellite', icon: 'cloud-lightning', source: 'ECCC GOES-West',
      layer: 'GOES-West_1km_VisibleIRSandwich-NightMicrophysicsIR', kind: 'observed', opacity: .68, z: 320, noLegend: true,
      description: 'Visible/IR sandwich by day and night microphysics IR after dark for storm structure.'
    },
    fireSatellite: {
      title: 'Fire temperature / SWIR', category: 'Satellite', icon: 'flame', source: 'ECCC GOES-West',
      layer: 'GOES-West_1km_FireTemperature-SWIR', kind: 'observed', opacity: .72, z: 325, noLegend: true,
      description: 'GOES-West fire-temperature and shortwave-infrared satellite product.'
    },
    lightning: {
      title: 'Lightning density', category: 'Storms', icon: 'zap', source: 'ECCC CLDN density',
      layer: 'Lightning_2.5km_Density', kind: 'observed', opacity: .84, z: 540,
      description: 'Official public lightning flash-density analysis. Exact strike points require a commercial lightning feed.'
    },
    thunderRisk: {
      title: 'Thunderstorm probability', category: 'Storms', icon: 'cloud-lightning', source: 'ECCC HRDPS WEonG',
      layer: 'HRDPS-WEonG_2.5km_Thunderstorm-Prob', kind: 'forecast', opacity: .52, z: 420,
      description: 'Hourly thunderstorm probability from high-resolution Canadian guidance.'
    },
    showalter: {
      title: 'Showalter index', category: 'Storms', icon: 'activity', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL.CONV_SHWINX.500', kind: 'forecast', opacity: .46, z: 390,
      description: 'Convective-instability diagnostic for advanced storm analysis.'
    },
    alerts: {
      title: 'Official alerts', category: 'Storms', icon: 'triangle-alert', source: 'Environment Canada',
      layer: 'Current-Alerts', style: 'Current-Alerts', kind: 'current', opacity: .96, z: 650,
      description: 'Official watches, warnings and advisories. Alert polygons stay above weather imagery.'
    },
    temperature: {
      title: 'Temperature', category: 'Atmosphere', icon: 'thermometer', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_TT', kind: 'forecast', opacity: .58, z: 365,
      description: 'High-resolution 2 m air temperature forecast.'
    },
    dewpoint: {
      title: 'Dew point', category: 'Atmosphere', icon: 'droplet', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_TD', kind: 'forecast', opacity: .56, z: 365,
      description: 'Dew point temperature for moisture and storm-environment analysis.'
    },
    humidity: {
      title: 'Relative humidity', category: 'Atmosphere', icon: 'waves', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_HR', kind: 'forecast', opacity: .52, z: 360,
      description: 'Near-surface relative humidity.'
    },
    pressure: {
      title: 'Sea-level pressure', category: 'Atmosphere', icon: 'gauge', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_PN-SLP', kind: 'forecast', opacity: .48, z: 370,
      description: 'Sea-level pressure field for synoptic weather analysis.'
    },
    clouds: {
      title: 'Cloud cover', category: 'Atmosphere', icon: 'cloud', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_NT', kind: 'forecast', opacity: .52, z: 350,
      description: 'Total cloud cover forecast.'
    },
    windSpeed: {
      title: 'Wind speed', category: 'Wind', icon: 'wind', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_WSPD', kind: 'forecast', opacity: .54, z: 385,
      description: 'High-resolution near-surface wind-speed field.'
    },
    windGust: {
      title: 'Wind gusts', category: 'Wind', icon: 'wind', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_WGE', kind: 'forecast', opacity: .56, z: 388,
      description: 'Estimated near-surface wind gusts.'
    },
    snowAccum: {
      title: 'Snow accumulation', category: 'Winter', icon: 'snowflake', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_SN', kind: 'forecast', opacity: .62, z: 405,
      description: 'Model snow accumulation.'
    },
    snowDepth: {
      title: 'Snow depth', category: 'Winter', icon: 'ruler', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_SD', kind: 'forecast', opacity: .58, z: 400,
      description: 'Forecast snow depth.'
    },
    freezingRain: {
      title: 'Freezing rain', category: 'Winter', icon: 'cloud-hail', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL_FR', kind: 'forecast', opacity: .66, z: 430,
      description: 'Forecast freezing-rain accumulation.'
    },
    modelPrecipType: {
      title: 'Forecast precip type', category: 'Winter', icon: 'cloud-snow', source: 'ECCC HRDPS',
      layer: 'HRDPS.CONTINENTAL.DIAG_PTYPE', kind: 'forecast', opacity: .62, z: 425,
      description: 'Model instantaneous precipitation type.'
    },
    aqhi: {
      title: 'Air Quality Health Index', category: 'Environment', icon: 'lungs', source: 'ECCC AQHI',
      layer: 'AQHI-OBS', kind: 'current', opacity: .72, z: 520,
      description: 'Official Canadian Air Quality Health Index observations.'
    },
    smoke: {
      title: 'Wildfire smoke PM2.5', category: 'Environment', icon: 'cloud-fog', source: 'ECCC FireWork',
      layer: 'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', kind: 'forecast', opacity: .58, z: 440,
      description: 'Wildfire-smoke PM2.5 plume forecast from the Canadian FireWork air-quality system.'
    }
  };

  const presets = {
    radar: { label: 'Radar+', layers: ['satellite', 'radar', 'lightning', 'alerts'] },
    storm: { label: 'Storm watch', layers: ['satelliteStorm', 'radar', 'lightning', 'thunderRisk', 'alerts'] },
    winter: { label: 'Winter', layers: ['radar', 'precipType', 'snowAccum', 'freezingRain', 'alerts'] },
    smoke: { label: 'Fire & smoke', layers: ['satellite', 'fireSatellite', 'smoke', 'windGust', 'alerts'] },
    synoptic: { label: 'Synoptic', layers: ['clouds', 'pressure', 'temperature', 'windGust'] }
  };

  const runtime = new Map();
  const metadata = new Map();
  const active = new Set(Array.isArray(saved.active) ? saved.active.filter(id => defs[id]) : ['radar']);
  const health = new Map();
  let map = null;
  let focused = 'radar';
  let masterTimes = [];
  let masterIndex = 0;
  let timer = null;
  let controlsOwned = false;
  let panelBuilt = false;
  let activeBar = null;
  let mapReadyHandled = false;

  window.StormLensPremiumOverlays = {
    ownsLegend: true,
    ownsStatus: true,
    defs,
    active,
    applyPreset,
    toggleLayer,
    get map() { return map; }
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function persist() {
    const opacities = {};
    runtime.forEach((item, id) => { opacities[id] = item.opacity; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: [...active], opacities, preset: saved.preset, mapStyle: saved.mapStyle }));
  }

  function notify(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toast._premiumTimer);
    toast._premiumTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function buildMasterTimes() {
    const step = 6 * 60 * 1000;
    const now = Math.floor(Date.now() / step) * step;
    const items = [];
    for (let minutes = -180; minutes <= 0; minutes += 6) items.push(new Date(now + minutes * 60000));
    for (let minutes = 30; minutes <= 180; minutes += 30) items.push(new Date(now + minutes * 60000));
    for (let minutes = 240; minutes <= 2880; minutes += 60) items.push(new Date(now + minutes * 60000));
    masterTimes = items;
    masterIndex = items.reduce((best, d, i) => Math.abs(d.getTime() - Date.now()) < Math.abs(items[best].getTime() - Date.now()) ? i : best, 0);
  }

  function parseDuration(value) {
    const match = String(value || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 360000;
    return (((Number(match[1] || 0) * 24 + Number(match[2] || 0)) * 60 + Number(match[3] || 0)) * 60 + Number(match[4] || 0)) * 1000 || 360000;
  }

  function parseTimeDimension(text) {
    if (!text) return [];
    const out = [];
    String(text).split(',').map(x => x.trim()).filter(Boolean).forEach(part => {
      if (!part.includes('/')) {
        const date = new Date(part);
        if (!Number.isNaN(date.getTime())) out.push(date);
        return;
      }
      const [startRaw, endRaw, periodRaw] = part.split('/');
      const start = new Date(startRaw), end = new Date(endRaw), increment = parseDuration(periodRaw);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !increment) return;
      for (let value = start.getTime(), guard = 0; value <= end.getTime() && guard < 2000; value += increment, guard++) out.push(new Date(value));
    });
    return [...new Map(out.map(date => [date.toISOString(), date])).values()].sort((a, b) => a - b);
  }

  function directChild(node, tagName) {
    return [...(node?.children || [])].find(child => child.localName === tagName || child.tagName === tagName);
  }

  async function getMetadata(id, force = false) {
    if (!force && metadata.has(id)) return metadata.get(id);
    const def = defs[id];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const params = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetCapabilities', layer:def.layer, _:String(Date.now()) });
      const response = await fetch(`${WMS}${params}`, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error(`GeoMet ${response.status}`);
      const text = await response.text();
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('Invalid capabilities response');
      const node = [...xml.querySelectorAll('Layer')].find(layerNode => directChild(layerNode, 'Name')?.textContent?.trim() === def.layer);
      if (!node) throw new Error('Layer not currently published');
      const timeNode = [...node.children].find(child => (child.localName === 'Dimension' || child.localName === 'Extent') && child.getAttribute('name') === 'time');
      const styles = [...node.children].filter(child => child.localName === 'Style').map(styleNode => directChild(styleNode, 'Name')?.textContent?.trim()).filter(Boolean);
      const result = { valid:true, times:parseTimeDimension(timeNode?.textContent?.trim() || ''), styles };
      metadata.set(id, result);
      return result;
    } catch (error) {
      const result = { valid:false, times:[], styles:[], error:error.name === 'AbortError' ? 'Timed out' : error.message };
      metadata.set(id, result);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  function nearestTime(times, desired) {
    if (!times?.length) return null;
    const target = desired.getTime();
    return times.reduce((best, item) => Math.abs(item.getTime() - target) < Math.abs(best.getTime() - target) ? item : best, times[0]);
  }

  function desiredOpacity(id) {
    const savedValue = Number(saved.opacities?.[id]);
    return Number.isFinite(savedValue) ? Math.max(.1, Math.min(1, savedValue)) : defs[id].opacity;
  }

  function wmsFactory() {
    return window.StormLensOriginalWms || L.tileLayer.wms;
  }

  function findFallbackRadar() {
    if (!map) return null;
    let found = null;
    map.eachLayer(layer => { if (layer?._stormlensProvider === 'rainviewer-fallback') found = layer; });
    return found;
  }

  function setFallbackRadarVisible(visible) {
    const fallback = findFallbackRadar();
    if (!fallback?.setOpacity) return;
    fallback.setOpacity(visible ? (fallback._stormlensDefaultOpacity || .78) : 0);
  }

  function layerTolerance(def) {
    if (def.kind === 'observed') return 25 * 60 * 1000;
    if (def.kind === 'nowcast') return 90 * 60 * 1000;
    if (def.kind === 'current') return 12 * 60 * 60 * 1000;
    return 4 * 60 * 60 * 1000;
  }

  function updateLayerTime(id, date = masterTimes[masterIndex]) {
    const item = runtime.get(id);
    if (!item || !date) return;
    const times = item.meta.times;
    if (!times.length) {
      item.outOfTime = false;
      item.layer.setOpacity(item.opacity);
      return;
    }
    const nearest = nearestTime(times, date);
    const outside = Math.abs(nearest.getTime() - date.getTime()) > layerTolerance(defs[id]);
    item.outOfTime = outside;
    if (outside) {
      item.layer.setOpacity(0);
      if (id === 'radar') setFallbackRadarVisible(false);
    } else {
      item.layer.setOpacity(item.opacity);
      item.layer.setParams({ time: nearest.toISOString() }, false);
    }
  }

  async function addLayer(id, quiet = false) {
    if (!map || !defs[id] || runtime.has(id)) return;
    active.add(id);
    health.set(id, 'loading');
    renderAll();
    const def = defs[id];
    const meta = await getMetadata(id);
    if (!active.has(id)) return;
    if (!meta.valid) {
      health.set(id, 'error');
      active.delete(id);
      renderAll();
      if (!quiet) notify(`${def.title} is unavailable from GeoMet right now.`);
      return;
    }

    const chosenStyle = def.style && (!meta.styles.length || meta.styles.includes(def.style)) ? def.style : '';
    const layer = wmsFactory()(WMS, {
      layers:def.layer,
      styles:chosenStyle,
      format:'image/png',
      transparent:true,
      version:'1.3.0',
      opacity:desiredOpacity(id),
      zIndex:def.z,
      keepBuffer:3,
      updateWhenIdle:false
    });
    layer._stormlensPremiumLayer = id;
    const item = { layer, meta, opacity:desiredOpacity(id), loads:0, errors:0, styleFallbackTried:false, outOfTime:false };
    runtime.set(id, item);

    layer.on('tileload', () => {
      item.loads += 1;
      health.set(id, 'live');
      if (id === 'radar') setFallbackRadarVisible(false);
      updateStatus();
      renderPanelState();
    });
    layer.on('tileerror', () => {
      item.errors += 1;
      if (item.loads === 0 && item.errors >= 3 && chosenStyle && !item.styleFallbackTried) {
        item.styleFallbackTried = true;
        layer.setParams({ styles:'' }, false);
        layer.redraw();
        return;
      }
      if (item.loads === 0 && item.errors >= 8) {
        health.set(id, 'error');
        if (id === 'radar') {
          setFallbackRadarVisible(true);
          const source = $('#radarSourceLine');
          if (source) source.textContent = 'Classic ECCC radar failed to render. RainViewer fallback is visible.';
        }
        updateStatus();
        renderPanelState();
      }
    });
    layer.addTo(map);
    updateLayerTime(id);
    health.set(id, 'loading');
    focused = id;
    updateLegend(id);
    updateStatus();
    renderAll();

    setTimeout(() => {
      const current = runtime.get(id);
      if (!current || current.loads || current.errors) return;
      health.set(id, 'waiting');
      updateStatus();
      renderPanelState();
    }, 7000);
  }

  function removeLayer(id) {
    const item = runtime.get(id);
    if (item?.layer && map?.hasLayer(item.layer)) map.removeLayer(item.layer);
    runtime.delete(id);
    active.delete(id);
    health.delete(id);
    if (id === 'radar') setFallbackRadarVisible(true);
    if (focused === id) focused = [...active].pop() || 'radar';
    persist();
    updateLegend(focused);
    updateStatus();
    renderAll();
  }

  async function toggleLayer(id, force) {
    const shouldEnable = typeof force === 'boolean' ? force : !active.has(id);
    if (shouldEnable) await addLayer(id);
    else removeLayer(id);
    persist();
  }

  async function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    saved.preset = name;
    const wanted = new Set(preset.layers);
    [...runtime.keys()].filter(id => !wanted.has(id)).forEach(removeLayer);
    [...active].filter(id => !wanted.has(id) && !runtime.has(id)).forEach(id => active.delete(id));
    for (const id of preset.layers) if (!runtime.has(id)) await addLayer(id, true);
    focused = preset.layers.includes('radar') ? 'radar' : preset.layers[preset.layers.length - 1];
    updateLegend(focused);
    persist();
    renderAll();
    notify(`${preset.label} layers loaded.`);
  }

  function setLayerOpacity(id, value) {
    const item = runtime.get(id);
    const opacity = Math.max(.1, Math.min(1, Number(value)));
    saved.opacities[id] = opacity;
    if (item) {
      item.opacity = opacity;
      if (!item.outOfTime) item.layer.setOpacity(opacity);
    }
    persist();
    renderActiveBar();
  }

  function legendUrl(id) {
    const def = defs[id];
    if (!def || def.noLegend) return '';
    const params = new URLSearchParams({ version:'1.3.0', service:'WMS', request:'GetLegendGraphic', sld_version:'1.1.0', layer:def.layer, format:'image/png' });
    if (def.style) params.set('STYLE', def.style);
    return `${WMS}${params}`;
  }

  function updateLegend(id) {
    const def = defs[id];
    const legend = $('#radarLegend');
    const source = $('#radarSourceLine');
    if (!legend || !def) return;
    if (id === 'radar') {
      legend.innerHTML = '<span><b class="legend-dot pr1"></b>Light</span><span><b class="legend-dot pr2"></b>Moderate</span><span><b class="legend-dot pr3"></b>Heavy</span><span><b class="legend-dot pr4"></b>Very heavy</span><span><b class="legend-dot pr5"></b>Extreme</span>';
    } else if (def.noLegend) {
      legend.innerHTML = `<span class="premium-legend-note">${esc(def.title)} imagery</span>`;
    } else {
      legend.innerHTML = `<span class="premium-legend-title">${esc(def.title)}</span><img class="premium-wms-legend" src="${esc(legendUrl(id))}" alt="${esc(def.title)} legend" />`;
    }
    if (source) source.textContent = `${def.title} · ${def.source} · ${def.kind === 'forecast' ? 'forecast guidance' : def.kind === 'nowcast' ? 'short-range nowcast' : 'observed/current data'}`;
  }

  function buildPanel() {
    const sheet = $('#layersModal .layer-sheet');
    if (!sheet || panelBuilt) return;
    panelBuilt = true;
    const categories = ['Precipitation','Storms','Satellite','Atmosphere','Wind','Winter','Environment'];
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="premium-layer-header">
        <div><span class="eyebrow">WEATHER MAP</span><h2>Layers</h2><p>Stack compatible weather data, adjust opacity and scrub every active time-aware layer together.</p></div>
        <button class="icon-button premium-close-layers" aria-label="Close layers"><i data-lucide="x"></i></button>
      </div>
      <div class="premium-presets">${Object.entries(presets).map(([id,p]) => `<button class="premium-preset ${saved.preset===id?'active':''}" data-premium-preset="${id}">${esc(p.label)}</button>`).join('')}</div>
      <div class="premium-layer-health"><span><b class="health-dot live"></b>Live</span><span><b class="health-dot loading"></b>Loading</span><span><b class="health-dot error"></b>Unavailable</span><span class="premium-count" id="premiumLayerCount"></span></div>
      <div class="premium-layer-groups">${categories.map(category => {
        const rows = Object.entries(defs).filter(([,def]) => def.category === category).map(([id,def]) => `
          <div class="premium-layer-row" data-premium-row="${id}">
            <button class="premium-layer-main" data-premium-toggle="${id}">
              <span class="premium-layer-icon"><i data-lucide="${def.icon}"></i></span>
              <span class="premium-layer-copy"><strong>${esc(def.title)}</strong><small>${esc(def.description)}</small><em>${esc(def.source)}</em></span>
              <span class="premium-layer-state"><b class="health-dot"></b><span>Off</span></span>
            </button>
            <div class="premium-opacity" data-premium-opacity-wrap="${id}" hidden>
              <span>Opacity</span><input type="range" min="10" max="100" step="1" value="${Math.round(desiredOpacity(id)*100)}" data-premium-opacity="${id}" aria-label="${esc(def.title)} opacity"/><output>${Math.round(desiredOpacity(id)*100)}%</output>
            </div>
          </div>`).join('');
        return `<section class="premium-layer-group"><h3>${category}</h3>${rows}</section>`;
      }).join('')}</div>
      <div class="premium-provider-note"><strong>Premium provider path</strong><p>Exact strike-level lightning, hail objects, storm-cell tracks, animated wind particles and long-range global forecast tiles switch on when their commercial provider keys are configured. StormLens never substitutes fake values.</p><div id="premiumProviderStatus" class="premium-provider-status">Checking configured providers…</div></div>`;

    sheet.querySelector('.premium-close-layers')?.addEventListener('click', () => { $('#layersModal').hidden = true; });
    sheet.querySelectorAll('[data-premium-preset]').forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.premiumPreset)));
    sheet.querySelectorAll('[data-premium-toggle]').forEach(button => button.addEventListener('click', () => toggleLayer(button.dataset.premiumToggle)));
    sheet.querySelectorAll('[data-premium-opacity]').forEach(input => input.addEventListener('input', () => {
      setLayerOpacity(input.dataset.premiumOpacity, Number(input.value) / 100);
      input.nextElementSibling.textContent = `${input.value}%`;
    }));
    refreshIcons();
    renderPanelState();
    loadProviderStatus();
  }

  function renderPanelState() {
    if (!panelBuilt) return;
    $$('[data-premium-row]').forEach(row => {
      const id = row.dataset.premiumRow;
      const isActive = active.has(id);
      const status = health.get(id) || (isActive ? 'loading' : 'off');
      row.classList.toggle('active', isActive);
      const state = row.querySelector('.premium-layer-state');
      const dot = state?.querySelector('.health-dot');
      const label = state?.querySelector('span');
      if (dot) dot.className = `health-dot ${status}`;
      if (label) label.textContent = ({off:'Off',loading:'Loading',live:'Live',error:'Unavailable',waiting:'Waiting'})[status] || status;
      const opacityWrap = row.querySelector(`[data-premium-opacity-wrap="${id}"]`);
      if (opacityWrap) opacityWrap.hidden = !isActive;
    });
    const count = $('#premiumLayerCount');
    if (count) count.textContent = `${active.size} active`;
    $$('[data-premium-preset]').forEach(button => button.classList.toggle('active', button.dataset.premiumPreset === saved.preset));
  }

  function refreshIcons() {
    if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
  }

  function ensureActiveBar() {
    if (activeBar || !$('#mapScreen')) return;
    activeBar = document.createElement('div');
    activeBar.className = 'premium-active-bar';
    activeBar.id = 'premiumActiveBar';
    $('#mapScreen').appendChild(activeBar);
  }

  function renderActiveBar() {
    ensureActiveBar();
    if (!activeBar) return;
    activeBar.innerHTML = [...active].map(id => {
      const def = defs[id], status = health.get(id) || 'loading';
      return `<button class="premium-active-chip ${focused===id?'focused':''}" data-premium-focus="${id}"><b class="health-dot ${status}"></b><span>${esc(def.title)}</span></button>`;
    }).join('');
    activeBar.querySelectorAll('[data-premium-focus]').forEach(button => button.addEventListener('click', () => {
      focused = button.dataset.premiumFocus;
      updateLegend(focused);
      renderActiveBar();
      const modal = $('#layersModal');
      if (modal && window.innerWidth < 760) modal.hidden = true;
    }));
  }

  function renderAll() {
    renderPanelState();
    renderActiveBar();
    syncQuickLayerChips();
    refreshIcons();
  }

  function syncQuickLayerChips() {
    const mapping = { radar:'radar', nowcast:'nowcast', lightning:'lightning', alerts:'alerts' };
    Object.entries(mapping).forEach(([buttonId, layerId]) => {
      const button = $(`#quickLayers [data-layer="${buttonId}"]`);
      if (button) button.classList.toggle('active', active.has(layerId));
    });
    const storms = $('#quickLayers [data-layer="storms"]');
    if (storms) storms.classList.toggle('active', active.has('thunderRisk'));
  }

  function openLayers() {
    buildPanel();
    const modal = $('#layersModal');
    if (modal) modal.hidden = false;
    renderAll();
  }

  function bindQuickLayers() {
    const rail = $('#quickLayers');
    if (!rail || rail.dataset.premiumBound) return;
    rail.dataset.premiumBound = 'true';
    rail.addEventListener('click', event => {
      const button = event.target.closest('[data-layer]');
      if (!button) return;
      const key = button.dataset.layer;
      if (!['radar','nowcast','lightning','storms','alerts','layers'].includes(key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (key === 'layers') return openLayers();
      if (key === 'storms') return applyPreset('storm');
      const layerId = {radar:'radar',nowcast:'nowcast',lightning:'lightning',alerts:'alerts'}[key];
      toggleLayer(layerId);
    }, true);
  }

  function deltaLabel(date) {
    const minutes = Math.round((date.getTime() - Date.now()) / 60000);
    if (Math.abs(minutes) < 8) return 'NOW';
    if (minutes < 0) return `${Math.abs(minutes)}M AGO`;
    if (minutes < 60) return `+${minutes}M`;
    const hours = minutes / 60;
    return `+${Number.isInteger(hours) ? hours : hours.toFixed(1)}H`;
  }

  function updateMasterTime() {
    const date = masterTimes[masterIndex];
    if (!date) return;
    runtime.forEach((_, id) => updateLayerTime(id, date));
    const range = $('#radarTimeline');
    if (range) range.value = String(masterIndex);
    const stamp = $('#radarTimestamp');
    if (stamp) stamp.textContent = date.toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    const mode = $('#radarModeLabel');
    const delta = date.getTime() - Date.now();
    if (mode) mode.textContent = delta > 10*60000 ? 'FORECAST WEATHER' : delta < -10*60000 ? 'OBSERVED HISTORY' : 'LIVE WEATHER';
    const start = $('#timelineStartLabel');
    const end = $('#timelineNowLabel');
    if (start) start.textContent = 'PAST 3H';
    if (end) end.textContent = deltaLabel(date);
    updateStatus();
    renderPanelState();
  }

  function stepMaster(direction) {
    masterIndex = Math.max(0, Math.min(masterTimes.length - 1, masterIndex + direction));
    updateMasterTime();
  }

  function setPlayIcon(playing) {
    const button = $('#radarPlay');
    if (!button) return;
    button.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
    refreshIcons();
  }

  function stopMaster() {
    if (timer) clearInterval(timer);
    timer = null;
    setPlayIcon(false);
  }

  function playMaster() {
    if (timer) return stopMaster();
    if (masterIndex >= masterTimes.length - 1) masterIndex = 0;
    timer = setInterval(() => {
      masterIndex = masterIndex >= masterTimes.length - 1 ? 0 : masterIndex + 1;
      updateMasterTime();
    }, Number(JSON.parse(localStorage.getItem('stormlens-settings') || '{}').radarSpeed || 650));
    setPlayIcon(true);
  }

  function ownTimelineControls() {
    if (controlsOwned) return;
    const range = $('#radarTimeline'), back = $('#radarStepBack'), forward = $('#radarStepForward'), play = $('#radarPlay');
    if (!range || !back || !forward || !play) return;
    controlsOwned = true;
    range.min = '0'; range.max = String(masterTimes.length - 1); range.step = '1'; range.value = String(masterIndex);
    range.addEventListener('input', event => { event.stopImmediatePropagation(); masterIndex = Number(range.value); updateMasterTime(); }, true);
    back.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); stopMaster(); stepMaster(-1); }, true);
    forward.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); stopMaster(); stepMaster(1); }, true);
    play.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); playMaster(); }, true);
    updateMasterTime();
  }

  function updateStatus() {
    const status = $('#mapLayerStatus');
    if (!status) return;
    const values = [...active].map(id => health.get(id));
    const errors = values.filter(value => value === 'error').length;
    const loading = values.filter(value => value === 'loading' || value === 'waiting').length;
    const live = values.filter(value => value === 'live').length;
    status.textContent = errors ? `${live}/${active.size} layers live · ${errors} unavailable` : loading ? `${live}/${active.size} layers live · loading` : `${active.size} weather layer${active.size===1?'':'s'} · LIVE`;
    const pill = $('#mapStatusPill');
    if (pill) pill.dataset.error = errors ? 'true' : 'false';
  }

  async function loadProviderStatus() {
    const el = $('#premiumProviderStatus');
    if (!el) return;
    try {
      const response = await fetch('/api/provider-status', { cache:'no-store' });
      if (!response.ok) throw new Error('status unavailable');
      const data = await response.json();
      const items = [
        ['Xweather exact lightning / storm intelligence', data.xweather],
        ['AccuWeather MinuteCast / future radar', data.accuweather],
        ['Tomorrow.io global premium map fields', data.tomorrow],
        ['Google pollen heatmaps', data.googlePollen],
        ['NASA FIRMS active fire hotspots', data.nasaFirms]
      ];
      el.innerHTML = items.map(([label,on]) => `<span class="provider-pill ${on?'ready':'missing'}"><b></b>${esc(label)} · ${on?'Configured':'Needs key'}</span>`).join('');
    } catch (_) {
      el.textContent = 'Commercial provider keys are not configured yet. Open ECCC layers remain active.';
    }
  }

  function addProviderStatusToSettings() {
    const card = $('#settingsModal .data-source-card');
    if (!card || card.querySelector('.premium-settings-note')) return;
    const block = document.createElement('div');
    block.className = 'premium-settings-note';
    block.innerHTML = '<p><strong>Premium map engine:</strong> ECCC classic radar, radar nowcast, GOES satellite, HRDPS atmospheric and winter fields, lightning density, AQHI and smoke layers are available without private keys. Exact lightning strikes, hail/rotation intelligence, wind particles and commercial global future-radar products require configured provider credentials.</p>';
    card.appendChild(block);
  }

  async function initializeMap(targetMap) {
    if (mapReadyHandled) return;
    mapReadyHandled = true;
    map = targetMap;
    buildMasterTimes();
    buildPanel();
    bindQuickLayers();
    ensureActiveBar();
    addProviderStatusToSettings();
    setTimeout(ownTimelineControls, 50);

    // Always attempt official ECCC classic radar first. The legacy RainViewer layer
    // remains underneath as an automatic visual fallback if GeoMet tile rendering fails.
    active.add('radar');
    for (const id of [...active]) await addLayer(id, true);
    updateLegend('radar');
    renderAll();
  }

  buildPanel();
  bindQuickLayers();
  addProviderStatusToSettings();
  buildMasterTimes();

  window.addEventListener('stormlens:map-ready', event => initializeMap(event.detail.map));
  if (window.StormLensMap) setTimeout(() => initializeMap(window.StormLensMap), 0);
})();
