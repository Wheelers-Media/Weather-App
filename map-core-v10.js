(() => {
  'use strict';

  const WMS = 'https://geo.weather.gc.ca/geomet?';
  const HOUR = 3600000;
  const MINUTE = 60000;
  const MERCATOR_MAX = 20037508.342789244;
  const WEATHER_KEY = 'stormlens-map-v10-weather';
  const BASE_KEY = 'stormlens-map-v10-base';
  const RANGE_KEY = 'stormlens-map-v10-ranges';
  const THEME_KEY = 'stormlens-theme-v10';

  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizedTime = value => new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');

  const defs = {
    radar: { title:'Radar forecast', category:'Precipitation', icon:'radar', provider:'maptiler', type:'radar', horizonHours:96, horizon:'4 days', mode:'forecast', description:'Smooth forecast radar reflectivity, dBZ.' },
    precipitation: { title:'Precipitation', category:'Precipitation', icon:'cloud-rain', provider:'maptiler', type:'precipitation', horizonHours:96, horizon:'4 days', mode:'forecast', description:'Smooth rain, snow, sleet and hail intensity forecast.' },
    officialRadar: { title:'Official radar', category:'Precipitation', icon:'scan-line', provider:'eccc', layer:'RADAR_1KM_RRAI', style:'RADARURPPRECIPR14-LINEAR', horizonHours:3, horizon:'3 hour history', mode:'observed', description:'Official ECCC observed Canadian radar at native resolution.' },
    nowcast: { title:'Radar nowcast', category:'Precipitation', icon:'cloud-rain-wind', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR', horizonHours:1, horizon:'short range', mode:'forecast', description:'Official extrapolated precipitation nowcast.' },
    precipType: { title:'Observed precip type', category:'Precipitation', icon:'cloud-snow', provider:'eccc', layer:'Radar_1km_SfcPrecipType', horizonHours:3, horizon:'observed', mode:'observed', description:'Observed rain, snow and mixed precipitation.' },
    precipProb: { title:'Precipitation probability', category:'Precipitation', icon:'percent', provider:'eccc', layer:'HRDPS-WEonG_2.5km_Precip-Prob', horizonHours:48, horizon:'48 hours', mode:'forecast', description:'Canadian high-resolution precipitation probability.' },
    rainAccum: { title:'Rain accumulation', category:'Precipitation', icon:'droplets', provider:'eccc', layer:'HRDPS.CONTINENTAL_RN', horizonHours:48, horizon:'48 hours', mode:'forecast', description:'Canadian accumulated rain forecast.' },
    extendedPrecip: { title:'Precipitation · 14d', category:'Precipitation', icon:'calendar-range', provider:'tomorrow', field:'precipitationIntensity', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended precipitation intensity forecast.' },

    thunderstorms: { title:'Thunderstorms · 14d', category:'Storms', icon:'cloud-lightning', provider:'tomorrow', field:'thunderstormProbability', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended thunderstorm probability forecast.' },
    lightningForecast: { title:'Lightning forecast', category:'Storms', icon:'zap', provider:'tomorrow', field:'lightningFlashRateDensity', horizonHours:90, horizon:'90 hours', mode:'forecast', description:'Forecast lightning flash-rate density.' },
    lightning: { title:'Lightning density', category:'Storms', icon:'zap', provider:'eccc', layer:'Lightning_2.5km_Density', style:'Lightning', horizonHours:3, horizon:'observed', mode:'observed', description:'Observed Canadian lightning-density analysis.' },
    thunderRisk: { title:'Thunderstorm probability · Canada', category:'Storms', icon:'cloud-lightning', provider:'eccc', layer:'HRDPS-WEonG_2.5km_Thunderstorm-Prob', horizonHours:48, horizon:'48 hours', mode:'forecast', description:'Canadian HRDPS thunderstorm probability.' },
    showalter: { title:'Showalter index', category:'Storms', icon:'activity', provider:'eccc', layer:'HRDPS.CONTINENTAL.CONV_SHWINX.500', horizonHours:48, horizon:'48 hours', mode:'forecast', description:'Convective instability diagnostic.' },
    alerts: { title:'Official alerts', category:'Storms', icon:'triangle-alert', provider:'eccc', layer:'Current-Alerts', style:'Current-Alerts', horizonHours:0, horizon:'current', mode:'current', description:'Environment Canada watches, warnings and advisories.' },

    temperature: { title:'Temperature', category:'Atmosphere', icon:'thermometer', provider:'maptiler', type:'temperature', horizonHours:96, horizon:'4 days', mode:'forecast', description:'Smooth forecast temperature.' },
    pressure: { title:'Pressure', category:'Atmosphere', icon:'gauge', provider:'maptiler', type:'pressure', horizonHours:96, horizon:'4 days', mode:'forecast', description:'Smooth sea-level pressure forecast.' },
    extendedTemp: { title:'Temperature · 14d', category:'Atmosphere', icon:'thermometer', provider:'tomorrow', field:'temperature', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended temperature forecast.' },
    humidity: { title:'Humidity · 14d', category:'Atmosphere', icon:'waves', provider:'tomorrow', field:'humidity', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended relative humidity forecast.' },
    dewPoint: { title:'Dew point · 14d', category:'Atmosphere', icon:'droplet', provider:'tomorrow', field:'dewPoint', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended dew-point forecast.' },
    clouds: { title:'Cloud cover · 14d', category:'Atmosphere', icon:'cloud', provider:'tomorrow', field:'cloudCover', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended cloud-cover forecast.' },
    visibility: { title:'Visibility · 14d', category:'Atmosphere', icon:'eye', provider:'tomorrow', field:'visibility', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended visibility forecast.' },

    wind: { title:'Wind', category:'Wind', icon:'wind', provider:'maptiler', type:'wind', horizonHours:96, horizon:'4 days', mode:'forecast', description:'Animated wind particles, speed and direction.' },
    windGust: { title:'Wind gusts · 14d', category:'Wind', icon:'wind', provider:'tomorrow', field:'windGust', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended wind-gust forecast.' },

    snow: { title:'Snow intensity · 14d', category:'Winter', icon:'snowflake', provider:'tomorrow', field:'snowIntensity', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended snowfall intensity forecast.' },
    freezingRain: { title:'Freezing rain · 14d', category:'Winter', icon:'cloud-hail', provider:'tomorrow', field:'freezingRainIntensity', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended freezing-rain intensity forecast.' },
    snowAccum: { title:'Snow accumulation', category:'Winter', icon:'snowflake', provider:'eccc', layer:'HRDPS.CONTINENTAL_SN', horizonHours:48, horizon:'48 hours', mode:'forecast', description:'Canadian accumulated snowfall forecast.' },
    snowDepth: { title:'Snow depth', category:'Winter', icon:'ruler', provider:'eccc', layer:'HRDPS.CONTINENTAL_SD', horizonHours:48, horizon:'48 hours', mode:'forecast', description:'Canadian snow-depth forecast.' },

    smoke: { title:'Wildfire smoke PM2.5', category:'Environment', icon:'cloud-fog', provider:'eccc', layer:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', horizonHours:72, horizon:'forecast', mode:'forecast', description:'Canadian wildfire-smoke PM2.5 forecast.' },
    aqhi: { title:'Air Quality Health Index', category:'Environment', icon:'lungs', provider:'eccc', layer:'AQHI-OBS', horizonHours:0, horizon:'current', mode:'current', description:'Official Canadian AQHI observations.' }
  };

  const categories = ['Precipitation','Storms','Atmosphere','Wind','Winter','Environment'];
  const maptilerKey = window.STORMLENS_PUBLIC_CONFIG?.mapTilerApiKey || '';

  let map = null;
  let initialized = false;
  let initializing = false;
  let selected = localStorage.getItem(WEATHER_KEY) || 'radar';
  if (!defs[selected]) selected = 'radar';
  let baseStyle = localStorage.getItem(BASE_KEY) || 'auto';
  let themeChoice = localStorage.getItem(THEME_KEY) || 'system';
  let active = null;
  let weatherLayer = null;
  let timeline = { mode:'none', start:0, end:0, current:0, times:[], index:0, options:[] };
  let currentRangeId = null;
  let playing = false;
  let playbackTimer = null;
  let selectionToken = 0;
  let styleChanging = false;
  let pendingStyleLayer = null;
  let tomorrowConfigured = false;
  let tomorrowReady = false;
  let providerStatus = null;
  let capabilitiesCache = new Map();
  let tomorrowProbeCache = new Map();
  let rasterFrames = new Map();
  let currentRasterKey = null;
  let valuePill = null;
  let rangePrefs = (() => { try { return JSON.parse(localStorage.getItem(RANGE_KEY) || '{}'); } catch (_) { return {}; } })();

  function settings() {
    try { return JSON.parse(localStorage.getItem('stormlens-settings') || '{}'); }
    catch (_) { return {}; }
  }

  function locationState() {
    try {
      const loc = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      if (loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) return loc;
    } catch (_) {}
    return { name:'Calgary', latitude:51.0447, longitude:-114.0719 };
  }

  function effectiveTheme() {
    if (themeChoice === 'light' || themeChoice === 'dark') return themeChoice;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme() {
    const resolved = effectiveTheme();
    document.documentElement.dataset.theme = resolved;
    document.body.dataset.theme = resolved;
    const app = $('#app'); if (app) app.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'light' ? '#f5f7fa' : '#070b12';
    const select = $('#stormlensThemeSelect'); if (select) select.value = themeChoice;
    if (map && baseStyle === 'auto') setBaseMap('auto', false);
  }

  function mapStyleObject(style=baseStyle) {
    const MT = maptilersdk.MapStyle;
    const light = effectiveTheme() === 'light';
    if (style === 'auto') return light ? MT.DATAVIZ.LIGHT : MT.DATAVIZ.DARK;
    if (style === 'standard') return light ? MT.STREETS : MT.STREETS.DARK;
    if (style === 'light') return MT.DATAVIZ.LIGHT;
    if (style === 'dark') return MT.DATAVIZ.DARK;
    if (style === 'satellite') return MT.HYBRID;
    if (style === 'terrain') return light ? MT.TOPO : MT.TOPO.DARK;
    return light ? MT.DATAVIZ.LIGHT : MT.DATAVIZ.DARK;
  }

  function refreshIcons() {
    if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
  }

  function setStatus(text, state='live') {
    const label = $('#mapLayerStatus'); if (label) label.textContent = text;
    const pill = $('#mapStatusPill'); if (pill) pill.dataset.state = state;
  }

  function showFatal(message) {
    setStatus(`Map unavailable · ${message}`, 'error');
    const container = $('#weatherMap');
    if (!container) return;
    container.innerHTML = `<div class="v10-map-error"><i data-lucide="triangle-alert"></i><strong>Weather map unavailable</strong><p>${escapeHtml(message)}</p><button id="v10RetryMap">Retry map</button></div>`;
    $('#v10RetryMap')?.addEventListener('click', () => { initialized=false; initializing=false; initWhenVisible(); });
    refreshIcons();
  }

  function mapVisible() {
    const screen = $('#mapScreen');
    if (!screen?.classList.contains('active')) return false;
    const r = screen.getBoundingClientRect();
    return r.width > 240 && r.height > 320;
  }

  async function waitForVisible() {
    while (!mapVisible()) await sleep(100);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function firstLabelLayer() {
    const layers = map?.getStyle()?.layers || [];
    return layers.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
  }

  function opacity() {
    return Math.max(.25, Math.min(1, Number(settings().radarOpacity || 78) / 100));
  }

  function addLocationPin() {
    if (!map?.isStyleLoaded?.()) return;
    const loc = locationState();
    const data = { type:'FeatureCollection', features:[{ type:'Feature', properties:{}, geometry:{type:'Point',coordinates:[Number(loc.longitude),Number(loc.latitude)]} }] };
    if (map.getSource('stormlens-user-location')) map.getSource('stormlens-user-location').setData(data);
    else map.addSource('stormlens-user-location', { type:'geojson', data });
    if (!map.getLayer('stormlens-user-location-halo')) map.addLayer({ id:'stormlens-user-location-halo', type:'circle', source:'stormlens-user-location', paint:{ 'circle-radius':12, 'circle-color':'#58aef5', 'circle-opacity':.16, 'circle-stroke-width':0 } });
    if (!map.getLayer('stormlens-user-location-dot')) map.addLayer({ id:'stormlens-user-location-dot', type:'circle', source:'stormlens-user-location', paint:{ 'circle-radius':6, 'circle-color':'#51aaf4', 'circle-stroke-color':'#ffffff', 'circle-stroke-width':2.4, 'circle-opacity':1 } });
  }

  function recenter() {
    const loc = locationState();
    map?.easeTo({ center:[Number(loc.longitude),Number(loc.latitude)], zoom:8.4, duration:650, essential:true });
    addLocationPin();
  }

  function removeWeatherLayer() {
    stopPlayback();
    if (weatherLayer) {
      try { weatherLayer.animateByFactor?.(0); } catch (_) {}
      try { map?.removeLayer(weatherLayer.id); } catch (_) { try { map?.removeLayer(weatherLayer); } catch (_) {} }
    }
    weatherLayer = null;
    clearRasterFrames();
    active = null;
  }

  function configureMapTilerLayer(def, token) {
    const base = { id:`stormlens-v10-${def.type}-${token}`, opacity:opacity(), smooth:true };
    if (def.type === 'wind') return { ...base, density:matchMedia('(pointer:coarse)').matches ? 1.6 : 2.1, maxAmount:matchMedia('(pointer:coarse)').matches ? 72 : 140, size:1.35, speed:.0011 };
    if (def.type === 'temperature' && maptilerweather.ColorRamp?.builtin?.TEMPERATURE_3) base.colorramp = maptilerweather.ColorRamp.builtin.TEMPERATURE_3;
    return base;
  }

  function mapTilerConstructor(type) {
    return ({ radar:maptilerweather.RadarLayer, precipitation:maptilerweather.PrecipitationLayer, temperature:maptilerweather.TemperatureLayer, pressure:maptilerweather.PressureLayer, wind:maptilerweather.WindLayer })[type] || null;
  }

  function rangeOptions(def, actualHours=def.horizonHours || 0) {
    if (def.mode === 'current' || actualHours <= 0) return [];
    if (def.mode === 'observed') {
      const out=[];
      if (actualHours >= 1) out.push({id:'1h',label:'1H',hours:1});
      if (actualHours >= 3) out.push({id:'3h',label:'3H',hours:3});
      return out;
    }
    const candidates=[{id:'6h',label:'6H',hours:6},{id:'24h',label:'24H',hours:24},{id:'48h',label:'48H',hours:48},{id:'4d',label:'4D',hours:96},{id:'14d',label:'14D',hours:336}];
    return candidates.filter(item => actualHours >= item.hours - 1 && item.hours <= (def.horizonHours || actualHours) + 1);
  }

  function chooseRange(def, options) {
    const saved = rangePrefs[active?.id || selected];
    if (saved && options.some(o => o.id === saved)) return saved;
    if (def.mode === 'observed') return options.at(-1)?.id || options[0]?.id;
    if (options.some(o => o.id === '24h')) return '24h';
    return options[0]?.id;
  }

  function saveRange(id) {
    if (!id) return;
    rangePrefs[selected] = id;
    localStorage.setItem(RANGE_KEY, JSON.stringify(rangePrefs));
  }

  function ensureRangeBar() {
    let bar = $('#stormlensTimelineRanges');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'stormlensTimelineRanges';
      bar.className = 'v10-range-bar';
      const slider = $('#radarTimeline');
      slider?.parentElement?.insertBefore(bar, slider);
      bar.addEventListener('click', event => {
        const button = event.target.closest('[data-v10-range]');
        if (!button) return;
        stopPlayback();
        currentRangeId = button.dataset.v10Range;
        saveRange(currentRangeId);
        applyRange(true);
      });
    }
    return bar;
  }

  function ensureSpeedBar() {
    let bar = $('#stormlensPlaybackSpeeds');
    if (!bar) {
      bar = document.createElement('div');
      bar.id='stormlensPlaybackSpeeds';
      bar.className='v10-speed-bar';
      bar.innerHTML='<span>Speed</span><button data-v10-speed="1200">0.5×</button><button data-v10-speed="650" class="active">1×</button><button data-v10-speed="350">2×</button>';
      const controller = $('#radarController');
      controller?.appendChild(bar);
      bar.addEventListener('click', event => {
        const btn=event.target.closest('[data-v10-speed]'); if(!btn)return;
        const s=settings(); s.radarSpeed=Number(btn.dataset.v10Speed); localStorage.setItem('stormlens-settings',JSON.stringify(s));
        bar.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
        if (playing) { stopPlayback(); startPlayback(); }
      });
    }
    const speed=Number(settings().radarSpeed || 650);
    bar.querySelectorAll('button').forEach(b=>b.classList.toggle('active',Number(b.dataset.v10Speed)===speed));
    return bar;
  }

  function renderRangeBar(options, activeId) {
    const bar=ensureRangeBar();
    if(!bar)return;
    bar.hidden=!options.length;
    bar.innerHTML=options.map(o=>`<button data-v10-range="${o.id}" class="${o.id===activeId?'active':''}">${o.label}</button>`).join('');
  }

  function configureSlider(min,max,value,step=1) {
    const slider=$('#radarTimeline'); if(!slider)return;
    const usable=Number.isFinite(min)&&Number.isFinite(max)&&max>min;
    slider.disabled=!usable;
    slider.min=usable?String(min):'0'; slider.max=usable?String(max):'1'; slider.step=usable?String(step):'1'; slider.value=usable?String(value):'0';
    updateSliderProgress();
  }

  function updateSliderProgress() {
    const slider=$('#radarTimeline'); if(!slider)return;
    const min=Number(slider.min),max=Number(slider.max),v=Number(slider.value);
    const pct=max>min?((v-min)/(max-min))*100:0;
    slider.style.setProperty('--v10-progress',`${Math.max(0,Math.min(100,pct))}%`);
  }

  function updateTimelineText(date,left,right,mode) {
    const d=date?new Date(date):null;
    if ($('#radarModeLabel')) $('#radarModeLabel').textContent=mode||'WEATHER';
    if ($('#radarTimestamp')) $('#radarTimestamp').textContent=d?d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Current';
    if ($('#timelineStartLabel')) $('#timelineStartLabel').textContent=left||'';
    if ($('#timelineNowLabel')) $('#timelineNowLabel').textContent=right||'';
  }

  function modeLabel(def) {
    if (def.provider==='maptiler') return 'FORECAST · SMOOTH';
    if (def.provider==='tomorrow') return 'FORECAST · EXTENDED';
    if (def.mode==='observed') return 'OBSERVED';
    if (def.mode==='forecast') return 'FORECAST';
    return 'CURRENT';
  }

  function rangeEndLabel(ms) {
    if (!ms) return '';
    const diff=Math.round((ms-Date.now())/HOUR);
    if(diff<=24)return `+${Math.max(0,diff)}H`;
    return new Date(ms).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  }

  function renderLegend(def) {
    const el=$('#radarLegend'); if(!el)return;
    if (def.type==='radar' || def.layer==='RADAR_1KM_RRAI' || def.layer==='Radar_1km_RainPrecipRate-Extrapolation') {
      el.innerHTML='<span><b class="legend-dot v10-l1"></b>Light</span><span><b class="legend-dot v10-l2"></b>Moderate</span><span><b class="legend-dot v10-l3"></b>Heavy</span><span><b class="legend-dot v10-l4"></b>Very heavy</span><span><b class="legend-dot v10-l5"></b>Extreme</span>';
    } else if (def.type==='wind') el.innerHTML='<span>Animated wind speed + direction</span>';
    else if (def.field==='thunderstormProbability') el.innerHTML='<span><b class="legend-dot v10-blue"></b>Low</span><span><b class="legend-dot v10-yellow"></b>Moderate</span><span><b class="legend-dot v10-red"></b>High</span><span><b class="legend-dot v10-purple"></b>Severe signal</span>';
    else el.innerHTML=`<span>${escapeHtml(def.title)}</span>`;
    const source=$('#radarSourceLine');
    if(source) source.textContent=`${def.title} · ${def.provider==='maptiler'?'MapTiler Weather':def.provider==='tomorrow'?'Tomorrow.io':'Environment and Climate Change Canada'}`;
  }

  function formatValue(def,value) {
    if(!value)return'';
    if(def.type==='radar'&&Number.isFinite(value.value))return `${value.value.toFixed(0)} dBZ`;
    if(def.type==='precipitation'&&Number.isFinite(value.value))return `${value.value.toFixed(1)} mm/h`;
    if(def.type==='temperature'&&Number.isFinite(value.value))return `${value.value.toFixed(1)} °C`;
    if(def.type==='pressure'&&Number.isFinite(value.value))return `${value.value.toFixed(0)} hPa`;
    if(def.type==='wind'&&Number.isFinite(value.speedKilometersPerHour))return `${value.compassDirection||''} ${value.speedKilometersPerHour.toFixed(0)} km/h`.trim();
    return'';
  }

  function showPickedValue(lngLat) {
    if(!active||active.def.provider!=='maptiler'||!weatherLayer)return;
    if(!valuePill){valuePill=document.createElement('div');valuePill.className='v10-value-pill';$('#mapScreen')?.appendChild(valuePill);}
    try{
      const value=weatherLayer.pickAt(lngLat.lng,lngLat.lat);const text=formatValue(active.def,value);
      if(!text){valuePill.hidden=true;return;}
      valuePill.innerHTML=`<small>${escapeHtml(active.def.title)}</small><strong>${escapeHtml(text)}</strong>`;valuePill.hidden=false;
    }catch(_){valuePill.hidden=true;}
  }

  async function activateMapTiler(id,token) {
    const def=defs[id]; const Constructor=mapTilerConstructor(def.type); if(!Constructor)throw new Error('Unsupported smooth weather layer');
    removeWeatherLayer();
    const layer=new Constructor(configureMapTilerLayer(def,token));
    weatherLayer=layer;
    const ready=new Promise((resolve,reject)=>{let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(new Error('Weather data timed out'));};layer.on('sourceReady',()=>finish(true));const timer=setTimeout(()=>finish(false),12000);});
    const before=firstLabelLayer(); if(before)map.addLayer(layer,before);else map.addLayer(layer);
    await ready;
    if(token!==selectionToken){try{map.removeLayer(layer.id);}catch(_){}return false;}
    active={id,def,provider:def.provider};selected=id;localStorage.setItem(WEATHER_KEY,id);
    bindMapTilerEvents(layer,id,def);
    applyMapTilerRange(true);
    syncUI(); setStatus(`${def.title} · READY`,'live'); addLocationPin(); return true;
  }

  function bindMapTilerEvents(layer,id,def) {
    layer.on('tick',()=>{
      if(weatherLayer!==layer||selected!==id)return;
      const t=+layer.getAnimationTimeDate();
      if(timeline.end&&t>=timeline.end-15000){layer.setAnimationTime(Math.round(timeline.start/1000));return;}
      timeline.current=t;
      const slider=$('#radarTimeline'); if(slider){slider.value=String(Math.max(timeline.start,Math.min(timeline.end,t)));updateSliderProgress();}
      updateTimelineText(t,'NOW',rangeEndLabel(timeline.end),modeLabel(def));
    });
    layer.on('animationTimeSet',()=>{
      if(weatherLayer!==layer||selected!==id)return;
      const t=+layer.getAnimationTimeDate(); timeline.current=t; updateTimelineText(t,'NOW',rangeEndLabel(timeline.end),modeLabel(def));
    });
  }

  function applyMapTilerRange(reset=false) {
    if(!weatherLayer||!active||active.provider!=='maptiler')return;
    const startAvail=+weatherLayer.getAnimationStartDate(); const endAvail=+weatherLayer.getAnimationEndDate();
    const start=Math.max(Date.now(),startAvail); const actualHours=Math.max(1,Math.floor((endAvail-start)/HOUR));
    const options=rangeOptions(active.def,actualHours); currentRangeId=options.some(o=>o.id===rangePrefs[selected])?rangePrefs[selected]:chooseRange(active.def,options); saveRange(currentRangeId);
    const option=options.find(o=>o.id===currentRangeId)||options[0]; const end=Math.min(endAvail,start+(option?.hours||actualHours)*HOUR);
    timeline={mode:'maptiler',start,end,current:reset?start:Math.max(start,Math.min(end,timeline.current||start)),times:[],index:0,options};
    renderRangeBar(options,currentRangeId); configureSlider(start,end,timeline.current,15*MINUTE); weatherLayer.setAnimationTime(Math.round(timeline.current/1000));
    updateTimelineText(timeline.current,'NOW',rangeEndLabel(end),modeLabel(active.def));
  }

  function parseDuration(v){const m=String(v||'').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);if(!m)return 360000;return (((Number(m[1]||0)*24+Number(m[2]||0))*60+Number(m[3]||0))*60+Number(m[4]||0))*1000||360000;}
  function parseTimes(text){if(!text)return[];const out=[];for(const p of String(text).split(',').map(s=>s.trim()).filter(Boolean)){if(!p.includes('/')){const d=new Date(p);if(!Number.isNaN(+d))out.push(d);continue;}const[a,b,period]=p.split('/');const s=new Date(a),e=new Date(b),step=parseDuration(period);if(Number.isNaN(+s)||Number.isNaN(+e)||step<=0)continue;for(let t=+s,g=0;t<=+e&&g<2500;t+=step,g++)out.push(new Date(t));}return[...new Map(out.map(d=>[d.toISOString(),d])).values()].sort((a,b)=>a-b);}
  function directChild(node,name){return[...(node?.children||[])].find(c=>c.localName===name||c.tagName===name);}

  async function ecccTimes(def) {
    if(def.mode==='current')return[];
    if(capabilitiesCache.has(def.layer))return capabilitiesCache.get(def.layer);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const params=new URLSearchParams({service:'WMS',version:'1.3.0',request:'GetCapabilities',layer:def.layer,_:String(Date.now())});
      const res=await fetch(`${WMS}${params}`,{cache:'no-store',signal:controller.signal});if(!res.ok)throw new Error(`GeoMet ${res.status}`);
      const xml=new DOMParser().parseFromString(await res.text(),'application/xml');const node=[...xml.querySelectorAll('Layer')].find(n=>directChild(n,'Name')?.textContent?.trim()===def.layer);if(!node)throw new Error('Layer not published');
      const timeNode=[...node.children].find(c=>(c.localName==='Dimension'||c.localName==='Extent')&&c.getAttribute('name')==='time');const times=parseTimes(timeNode?.textContent?.trim()||'');capabilitiesCache.set(def.layer,times);return times;
    }finally{clearTimeout(timeout);}
  }

  function buildEcccTemplate(def,date){const p=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:def.layer,STYLES:def.style||'',FORMAT:'image/png',TRANSPARENT:'true',SRS:'EPSG:3857',WIDTH:'512',HEIGHT:'512'});if(date)p.set('TIME',normalizedTime(date));return`${WMS}${p.toString()}&BBOX={bbox-epsg-3857}`;}
  function tomorrowTemplate(def,date){return`/api/tomorrow-tile?z={z}&x={x}&y={y}&field=${encodeURIComponent(def.field)}&time=${encodeURIComponent(normalizedTime(date))}`;}

  async function getProviderStatus(){if(providerStatus)return providerStatus;try{const r=await fetch('/api/provider-status',{cache:'no-store'});providerStatus=r.ok?await r.json():{};}catch(_){providerStatus={};}return providerStatus;}
  async function probeTomorrow(field){if(tomorrowProbeCache.has(field))return tomorrowProbeCache.get(field);try{const r=await fetch(`/api/tomorrow-probe?field=${encodeURIComponent(field)}`,{cache:'no-store'});const d=r.ok?await r.json():{available:false};tomorrowProbeCache.set(field,d);return d;}catch(_){return{available:false};}}

  function buildRasterTimeline(def,allTimes) {
    let actualHours=def.horizonHours||0;
    if(allTimes.length>1)actualHours=def.mode==='observed'?Math.ceil((+allTimes.at(-1)-+allTimes[0])/HOUR):Math.max(1,Math.ceil((+allTimes.at(-1)-Date.now())/HOUR));
    const options=rangeOptions(def,Math.min(def.horizonHours||actualHours,actualHours||def.horizonHours));
    currentRangeId=options.some(o=>o.id===rangePrefs[selected])?rangePrefs[selected]:chooseRange(def,options);saveRange(currentRangeId);
    const option=options.find(o=>o.id===currentRangeId)||options[0];let times=allTimes;
    if(def.mode==='observed'&&option&&times.length){const latest=+times.at(-1);times=times.filter(d=>+d>=latest-option.hours*HOUR);}
    else if(def.mode==='forecast'&&option&&times.length){const now=Date.now();const first=times.find(d=>+d>=now-HOUR)||times[0];times=times.filter(d=>+d>=+first&&+d<=+first+option.hours*HOUR);}
    const index=def.mode==='observed'?Math.max(0,times.length-1):0;
    timeline={mode:'raster',start:times[0]?+times[0]:0,end:times.at(-1)?+times.at(-1):0,current:times[index]?+times[index]:0,times,index,options};
    renderRangeBar(options,currentRangeId);configureSlider(0,Math.max(0,times.length-1),index,1);
    updateTimelineText(times[index],def.mode==='observed'?`PAST ${currentRangeId?.toUpperCase()||''}`:'NOW',times.length>1?rangeEndLabel(+times.at(-1)):def.horizon.toUpperCase(),modeLabel(def));
  }

  function buildTomorrowTimeline(def) {
    const now=Math.floor(Date.now()/HOUR)*HOUR;const options=rangeOptions(def,def.horizonHours);currentRangeId=options.some(o=>o.id===rangePrefs[selected])?rangePrefs[selected]:chooseRange(def,options);saveRange(currentRangeId);
    const option=options.find(o=>o.id===currentRangeId)||options[0];const end=now+(option?.hours||def.horizonHours)*HOUR;const step=(option?.hours||24)>=336?3*HOUR:HOUR;const times=[];for(let t=now;t<=end;t+=step)times.push(new Date(t));
    timeline={mode:'raster',start:now,end,current:now,times,index:0,options};renderRangeBar(options,currentRangeId);configureSlider(0,Math.max(0,times.length-1),0,1);updateTimelineText(times[0],'NOW',rangeEndLabel(end),modeLabel(def));
  }

  function rasterFrameKey(index){const date=timeline.times[index];return`${selected}:${date?normalizedTime(date):'current'}`;}
  function rasterTemplate(def,date){return def.provider==='tomorrow'?tomorrowTemplate(def,date):buildEcccTemplate(def,date);}

  async function ensureRasterFrame(index) {
    if(!active||timeline.mode!=='raster'||index<0||index>=timeline.times.length)return null;
    const key=rasterFrameKey(index);if(rasterFrames.has(key))return rasterFrames.get(key);
    const def=active.def,date=timeline.times[index],source=`stormlens-v10-raster-source-${Math.abs(hash(key))}`,layer=`stormlens-v10-raster-layer-${Math.abs(hash(key))}`;
    const frame={key,index,source,layer,ready:false,promise:null};
    frame.promise=new Promise(resolve=>{
      const template=rasterTemplate(def,date);
      map.addSource(source,{type:'raster',tiles:[template],tileSize:def.provider==='tomorrow'?256:512,minzoom:1,maxzoom:12,attribution:def.provider==='tomorrow'?'Tomorrow.io':'Environment and Climate Change Canada'});
      const spec={id:layer,type:'raster',source,paint:{'raster-opacity':0,'raster-resampling':'linear','raster-fade-duration':120}};const before=firstLabelLayer();if(before)map.addLayer(spec,before);else map.addLayer(spec);
      const started=performance.now();const poll=()=>{if(!map?.getSource(source)){resolve(false);return;}if(map.isSourceLoaded?.(source)){frame.ready=true;resolve(true);return;}if(performance.now()-started>3500){resolve(false);return;}setTimeout(poll,70);};poll();
    });
    rasterFrames.set(key,frame);return frame;
  }

  function hash(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i)|0;return h;}
  function removeRasterFrame(frame){if(!map||!frame)return;try{if(map.getLayer(frame.layer))map.removeLayer(frame.layer);}catch(_){}try{if(map.getSource(frame.source))map.removeSource(frame.source);}catch(_){}rasterFrames.delete(frame.key);}
  function clearRasterFrames(){for(const f of rasterFrames.values())removeRasterFrame(f);rasterFrames.clear();currentRasterKey=null;}

  async function showRasterIndex(index,{quiet=false}={}) {
    if(!active||timeline.mode!=='raster'||!timeline.times.length)return false;index=Math.max(0,Math.min(timeline.times.length-1,index));
    if(!quiet)setStatus(`${active.def.title} · loading`,'loading');const frame=await ensureRasterFrame(index);if(!frame)return false;await Promise.race([frame.promise,sleep(3600)]);
    if(!map?.getLayer(frame.layer))return false;
    const old=currentRasterKey?rasterFrames.get(currentRasterKey):null;map.setPaintProperty(frame.layer,'raster-opacity',opacity());if(old&&old.key!==frame.key&&map.getLayer(old.layer))map.setPaintProperty(old.layer,'raster-opacity',0);map.triggerRepaint?.();currentRasterKey=frame.key;
    timeline.index=index;timeline.current=+timeline.times[index];const slider=$('#radarTimeline');if(slider){slider.value=String(index);updateSliderProgress();}
    updateTimelineText(timeline.times[index],active.def.mode==='observed'?`PAST ${currentRangeId?.toUpperCase()||''}`:'NOW',rangeEndLabel(timeline.end),modeLabel(active.def));setStatus(`${active.def.title} · LIVE`,'live');
    trimRasterFrames(index);return true;
  }

  function trimRasterFrames(center){for(const frame of [...rasterFrames.values()])if(Math.abs(frame.index-center)>5)removeRasterFrame(frame);}
  async function bufferRaster(count=3){const indices=[];const jump=rasterJump();for(let n=1;n<=count;n++){let i=timeline.index+n*jump;if(i>=timeline.times.length)i%=timeline.times.length;indices.push(i);}for(let n=0;n<indices.length;n++){setStatus(`${active.def.title} · buffering ${n+1}/${indices.length}`,'loading');const f=await ensureRasterFrame(indices[n]);if(f)await Promise.race([f.promise,sleep(1600)]);}setStatus(`${active.def.title} · READY`,'live');}

  async function activateEccc(id,token) {
    const def=defs[id];removeWeatherLayer();active={id,def,provider:def.provider};selected=id;localStorage.setItem(WEATHER_KEY,id);
    if(def.mode==='current'){timeline={mode:'raster',start:0,end:0,current:0,times:[new Date()],index:0,options:[]};renderRangeBar([],null);configureSlider(0,1,0,1);await showRasterIndex(0);}
    else{const times=await ecccTimes(def);if(token!==selectionToken)return false;if(!times.length)throw new Error('No valid ECCC time frames');buildRasterTimeline(def,times);await showRasterIndex(timeline.index);}
    syncUI();addLocationPin();return true;
  }

  async function activateTomorrow(id,token) {
    const def=defs[id];if(!tomorrowConfigured)throw new Error('Tomorrow.io key not configured');const probe=await probeTomorrow(def.field);if(token!==selectionToken)return false;if(!probe.available)throw new Error('Layer not available on Tomorrow.io plan');
    removeWeatherLayer();active={id,def,provider:def.provider};selected=id;localStorage.setItem(WEATHER_KEY,id);buildTomorrowTimeline(def);await showRasterIndex(0);syncUI();addLocationPin();return true;
  }

  async function selectLayer(id,{quiet=false,force=false}={}) {
    if(!defs[id]||!map||styleChanging)return false;if(!force&&active?.id===id)return true;stopPlayback();const token=++selectionToken;setStatus(`${defs[id].title} · loading`,'loading');
    try{let ok;if(defs[id].provider==='maptiler')ok=await activateMapTiler(id,token);else if(defs[id].provider==='tomorrow')ok=await activateTomorrow(id,token);else ok=await activateEccc(id,token);if(token!==selectionToken)return false;if(!ok)return false;if(!quiet)closeLayers();return true;}
    catch(error){console.warn('[StormLens V10 layer]',id,error);setStatus(`${defs[id].title} · ${error.message||'unavailable'}`,'error');return false;}
  }

  function applyRange(reset=false){if(!active)return;if(active.provider==='maptiler')return applyMapTilerRange(reset);if(active.provider==='tomorrow'){buildTomorrowTimeline(active.def);showRasterIndex(0).catch(()=>{});return;}ecccTimes(active.def).then(times=>{if(active&&times.length){buildRasterTimeline(active.def,times);showRasterIndex(timeline.index).catch(()=>{});}});}

  function rasterJump(){if(currentRangeId==='14d')return 2;if(currentRangeId==='4d')return 2;return 1;}
  function speedDelay(){const v=Number(settings().radarSpeed||650);return Math.max(240,v);}
  function mapTilerFactor(){const v=Number(settings().radarSpeed||650);if(v>=1000)return 1800;if(v>=500)return 3600;return 7200;}

  function setPlayUI(on){playing=on;const b=$('#radarPlay');if(b){b.innerHTML=on?'<i data-lucide="pause"></i>':'<i data-lucide="play"></i>';b.setAttribute('aria-pressed',String(on));}refreshIcons();}
  function stopPlayback(){if(playbackTimer)clearTimeout(playbackTimer);playbackTimer=null;try{weatherLayer?.animateByFactor?.(0);}catch(_){}setPlayUI(false);}

  async function rasterTick(){if(!playing||timeline.mode!=='raster')return;let next=timeline.index+rasterJump();if(next>=timeline.times.length)next=0;await showRasterIndex(next,{quiet:true});if(!playing)return;const ahead=next+rasterJump();if(ahead<timeline.times.length)ensureRasterFrame(ahead).catch?.(()=>{});playbackTimer=setTimeout(rasterTick,speedDelay());}

  async function startPlayback(){if(!active)return;if(timeline.mode==='maptiler'&&weatherLayer){setPlayUI(true);if(timeline.current>=timeline.end-60000){timeline.current=timeline.start;weatherLayer.setAnimationTime(Math.round(timeline.start/1000));}weatherLayer.animateByFactor(mapTilerFactor());return;}if(timeline.mode==='raster'&&timeline.times.length>1){setPlayUI(true);await bufferRaster(3);if(!playing)return;rasterTick();return;}setStatus('No animation frames available','error');}

  function togglePlayback(){if(playing)stopPlayback();else startPlayback();}
  function stepFrame(dir){stopPlayback();if(timeline.mode==='maptiler'&&weatherLayer){const step=currentRangeId==='6h'?15*MINUTE:currentRangeId==='24h'?30*MINUTE:HOUR;const next=Math.max(timeline.start,Math.min(timeline.end,(timeline.current||timeline.start)+dir*step));timeline.current=next;weatherLayer.setAnimationTime(Math.round(next/1000));const s=$('#radarTimeline');if(s){s.value=String(next);updateSliderProgress();}return;}if(timeline.mode==='raster'&&timeline.times.length)showRasterIndex(Math.max(0,Math.min(timeline.times.length-1,timeline.index+dir))).catch(()=>{});}

  let sliderTimer=null;
  function bindController(){const slider=$('#radarTimeline');if(slider&&!slider.dataset.v10Bound){slider.dataset.v10Bound='true';slider.addEventListener('input',()=>{stopPlayback();clearTimeout(sliderTimer);if(timeline.mode==='maptiler'&&weatherLayer){const t=Math.max(timeline.start,Math.min(timeline.end,Number(slider.value)));timeline.current=t;weatherLayer.setAnimationTime(Math.round(t/1000));updateSliderProgress();}else if(timeline.mode==='raster'){const i=Math.max(0,Math.min(timeline.times.length-1,Number(slider.value)));updateTimelineText(timeline.times[i],active?.def.mode==='observed'?`PAST ${currentRangeId?.toUpperCase()||''}`:'NOW',rangeEndLabel(timeline.end),active?modeLabel(active.def):'WEATHER');updateSliderProgress();sliderTimer=setTimeout(()=>showRasterIndex(i).catch(()=>{}),90);}});}
    $('#radarPlay')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();togglePlayback();},true);$('#radarStepBack')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stepFrame(-1);},true);$('#radarStepForward')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stepFrame(1);},true);ensureRangeBar();ensureSpeedBar();}

  function quickTarget(key){if(key==='radar')return'radar';if(key==='nowcast')return'nowcast';if(key==='lightning')return tomorrowReady?'lightningForecast':'lightning';if(key==='storms')return tomorrowReady?'thunderstorms':'thunderRisk';if(key==='alerts')return'alerts';return null;}
  function syncQuick(){['radar','nowcast','lightning','storms','alerts'].forEach(key=>{const b=$(`#quickLayers [data-layer="${key}"]`);if(!b)return;const target=quickTarget(key);const activeNow=selected===target||(key==='lightning'&&['lightningForecast','lightning'].includes(selected))||(key==='storms'&&['thunderstorms','thunderRisk'].includes(selected));b.classList.toggle('active',activeNow);b.setAttribute('aria-pressed',String(activeNow));});}
  function syncUI(){syncQuick();renderLayerSelection();renderLegend(defs[selected]);const source=$('#radarSourceLine');if(source)source.textContent=`${defs[selected].title} · ${defs[selected].horizon}`;window.dispatchEvent(new CustomEvent('stormlens:weather-layer-changed',{detail:{id:selected,def:defs[selected]}}));}

  function bindMapInputs(){document.addEventListener('click',event=>{const quick=event.target.closest?.('#quickLayers [data-layer]');if(quick){event.preventDefault();event.stopImmediatePropagation();const key=quick.dataset.layer;if(key==='layers')return openLayers();const target=quickTarget(key);if(target)selectLayer(target);return;}const row=event.target.closest?.('[data-v10-weather]');if(row){event.preventDefault();event.stopImmediatePropagation();selectLayer(row.dataset.v10Weather);return;}if(event.target.closest?.('#openStormMap')){event.preventDefault();event.stopImmediatePropagation();document.querySelector('.nav-item[data-target="map"]')?.click();setTimeout(()=>selectLayer(tomorrowReady?'thunderstorms':'thunderRisk'),160);return;}if(event.target.closest?.('#openLightningMap')){event.preventDefault();event.stopImmediatePropagation();document.querySelector('.nav-item[data-target="map"]')?.click();setTimeout(()=>selectLayer(tomorrowReady?'lightningForecast':'lightning'),160);}},true);$('#recenterBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();recenter();},true);}

  function providerBadge(def){if(def.provider==='maptiler')return'SMOOTH · 4D';if(def.provider==='tomorrow')return def.horizonHours>=336?'EXTENDED · 14D':`EXTENDED · ${def.horizonHours}H`;if(def.mode==='observed')return'OFFICIAL · OBSERVED';if(def.mode==='current')return'OFFICIAL · CURRENT';return`CANADA · ${def.horizonHours||48}H`;}
  function mapCards(){const cards=[['auto','Auto','Follows app theme','auto'],['standard','Standard','Roads + labels','standard'],['light','Light','Weather-focused','light'],['dark','Dark','Weather-focused','dark'],['satellite','Satellite','Imagery + labels','satellite'],['terrain','Terrain','Topo context','terrain']];return cards.map(([id,title,sub,p])=>`<button class="map-type-card ${baseStyle===id?'active':''}" data-v10-map-style="${id}"><span class="map-type-preview preview-${p}"></span><strong>${title}</strong><small>${sub}</small></button>`).join('');}
  function layerRows(){return categories.map(category=>{const rows=Object.entries(defs).filter(([,d])=>d.category===category&&(d.provider!=='tomorrow'||tomorrowConfigured)).map(([id,d])=>`<button class="v6-layer-row ${selected===id?'active':''}" data-v10-weather="${id}"><span class="v6-layer-icon"><i data-lucide="${d.icon}"></i></span><span class="v6-layer-copy"><strong>${escapeHtml(d.title)}</strong><small>${escapeHtml(d.description)}</small></span><span class="v10-layer-meta">${providerBadge(d)}</span><span class="v6-radio"><b></b></span></button>`).join('');return rows?`<section class="v6-layer-group"><h3>${category}</h3>${rows}</section>`:'';}).join('');}
  function buildLayerSheet(){const sheet=$('#layersModal .layer-sheet');if(!sheet)return;sheet.innerHTML=`<div class="sheet-handle"></div><div class="sheet-title-row"><div><span class="eyebrow">MAP</span><h2>Map layers</h2></div><button class="icon-button v10-close-layers"><i data-lucide="x"></i></button></div><section class="v6-map-type-section"><div class="v6-section-head"><div><span class="eyebrow">BASE MAP</span><h3>Map type</h3></div><small>Independent from weather</small></div><div class="map-type-grid">${mapCards()}</div></section><section class="v6-weather-section"><div class="v6-section-head"><div><span class="eyebrow">WEATHER</span><h3>Weather layer</h3></div><small>One active layer at a time</small></div><div class="v10-current-layer"><span class="health-dot live"></span><strong id="v10SelectedLayer">${escapeHtml(defs[selected].title)}</strong><small>${escapeHtml(defs[selected].horizon)}</small></div><div class="v6-layer-groups">${layerRows()}</div></section>`;sheet.querySelector('.v10-close-layers')?.addEventListener('click',closeLayers);sheet.querySelectorAll('[data-v10-map-style]').forEach(b=>b.addEventListener('click',()=>setBaseMap(b.dataset.v10MapStyle)));sheet.querySelectorAll('[data-v10-weather]').forEach(b=>b.addEventListener('click',()=>selectLayer(b.dataset.v10Weather)));refreshIcons();}
  function renderLayerSelection(){$$('[data-v10-weather]').forEach(r=>r.classList.toggle('active',r.dataset.v10Weather===selected));$$('[data-v10-map-style]').forEach(r=>r.classList.toggle('active',r.dataset.v10MapStyle===baseStyle));const n=$('#v10SelectedLayer');if(n)n.textContent=defs[selected]?.title||'';}
  function openLayers(){buildLayerSheet();const m=$('#layersModal');if(m)m.hidden=false;}
  function closeLayers(){const m=$('#layersModal');if(m)m.hidden=true;}

  function injectSettings(){const list=$('#settingsModal .settings-list');if(!list)return;if(!$('#stormlensThemeSelect')){const row=document.createElement('div');row.className='setting-row';row.innerHTML='<span><strong>Appearance</strong><small>App theme</small></span><select id="stormlensThemeSelect"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select>';list.insertBefore(row,list.firstChild?.nextSibling||list.firstChild);$('#stormlensThemeSelect').value=themeChoice;$('#stormlensThemeSelect').addEventListener('change',e=>{themeChoice=e.target.value;localStorage.setItem(THEME_KEY,themeChoice);applyTheme();});}if(!$('#stormlensMapStyleSelect')){const row=document.createElement('div');row.className='setting-row';row.innerHTML='<span><strong>Default map</strong><small>Map underneath weather</small></span><select id="stormlensMapStyleSelect"><option value="auto">Auto</option><option value="standard">Standard</option><option value="light">Light</option><option value="dark">Dark</option><option value="satellite">Satellite</option><option value="terrain">Terrain</option></select>';list.insertBefore(row,list.firstChild?.nextSibling||list.firstChild);$('#stormlensMapStyleSelect').value=baseStyle;$('#stormlensMapStyleSelect').addEventListener('change',e=>setBaseMap(e.target.value));}}

  function setBaseMap(style,persist=true){if(!map||styleChanging)return;baseStyle=style;if(persist)localStorage.setItem(BASE_KEY,style);const sel=$('#stormlensMapStyleSelect');if(sel)sel.value=style;pendingStyleLayer=selected;styleChanging=true;removeWeatherLayer();map.setStyle(mapStyleObject(style));}
  function handleStyleLoad(){addLocationPin();if(!styleChanging)return;styleChanging=false;const id=pendingStyleLayer||selected;pendingStyleLayer=null;setTimeout(()=>selectLayer(id,{quiet:true,force:true}),100);}

  async function initializeProviders(){const status=await getProviderStatus();tomorrowConfigured=Boolean(status.tomorrow);if(tomorrowConfigured){const p=await probeTomorrow('thunderstormProbability');tomorrowReady=Boolean(p.available);}buildLayerSheet();injectSettings();syncQuick();}

  async function initWhenVisible(){if(initialized||initializing)return;if(!maptilerKey){showFatal('MapTiler API key is missing from the production build.');return;}initializing=true;try{await waitForVisible();maptilersdk.config.apiKey=maptilerKey;const container=$('#weatherMap');container.innerHTML='';const loc=locationState();map=new maptilersdk.Map({container:'weatherMap',style:mapStyleObject(baseStyle),center:[Number(loc.longitude),Number(loc.latitude)],zoom:7.4,attributionControl:true,navigationControl:false,terrainControl:false});window.StormLensMap=map;window.StormLensMapV10=api;map.on('error',event=>{const msg=String(event?.error?.message||'Map render error');if(/401|403|api.?key|forbidden|unauthor/i.test(msg))showFatal('MapTiler authorization failed. Check the API key and allowed origins.');});map.on('style.load',handleStyleLoad);map.on('click',e=>showPickedValue(e.lngLat));await new Promise((resolve,reject)=>{let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(new Error('MapTiler base map timed out'));};map.once('load',()=>finish(true));const timer=setTimeout(()=>finish(false),15000);});map.resize();addLocationPin();bindController();bindMapInputs();injectSettings();await initializeProviders();const initial=defs[selected]?.provider==='tomorrow'&&!tomorrowReady?'radar':selected;await selectLayer(initial,{quiet:true,force:true});initialized=true;document.documentElement.dataset.mapEngine='v10';setStatus(`${defs[selected].title} · READY`,'live');window.dispatchEvent(new CustomEvent('stormlens:map-ready',{detail:{map,engine:'v10'}}));}catch(error){console.error('[StormLens V10 init]',error);showFatal(error.message||'Map failed to initialize');}finally{initializing=false;}}

  const api={get map(){return map;},get selectedLayer(){return selected;},get tomorrowEnabled(){return tomorrowReady;},defs,selectLayer,setBaseMap,openLayers,stopPlayback,recenter};
  window.StormLensMapV10=api;

  applyTheme();
  injectSettings();
  document.addEventListener('stormlens:map-screen-visible',()=>setTimeout(initWhenVisible,0));
  document.addEventListener('DOMContentLoaded',()=>{if(mapVisible())initWhenVisible();});
  window.addEventListener('resize',()=>{if(mapVisible())map?.resize?.();});
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(themeChoice==='system')applyTheme();});
})();
