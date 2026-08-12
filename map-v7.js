(() => {
  'use strict';

  const publicConfig = window.STORMLENS_PUBLIC_CONFIG || {};
  const apiKey = publicConfig.mapTilerApiKey || '';
  if (!apiKey || !window.maptilersdk || !window.maptilerweather) return;

  const { maptilersdk, maptilerweather } = window;
  maptilersdk.config.apiKey = apiKey;

  const WMS = 'https://geo.weather.gc.ca/geomet?';
  const THEME_STORAGE = 'stormlens-theme-v6';
  const MAP_STYLE_STORAGE = 'stormlens-basemap-v6';
  const WEATHER_STORAGE = 'stormlens-weather-layer-v7';

  const MAPTILER_LAYERS = {
    forecastRadar: {
      title:'Forecast radar', category:'Precipitation', icon:'radar', provider:'maptiler', type:'radar',
      horizon:'Next 4 days', description:'Smooth forecast composite reflectivity in dBZ.'
    },
    precipitation: {
      title:'Precipitation', category:'Precipitation', icon:'cloud-rain', provider:'maptiler', type:'precipitation',
      horizon:'Next 4 days', description:'Smooth rain, snow, hail and sleet rate forecast.'
    },
    temperature: {
      title:'Temperature', category:'Atmosphere', icon:'thermometer', provider:'maptiler', type:'temperature',
      horizon:'Next 4 days', description:'Smooth 2 m air-temperature forecast.'
    },
    pressure: {
      title:'Pressure', category:'Atmosphere', icon:'gauge', provider:'maptiler', type:'pressure',
      horizon:'Next 4 days', description:'Smooth mean sea-level pressure forecast.'
    },
    wind: {
      title:'Wind', category:'Wind', icon:'wind', provider:'maptiler', type:'wind',
      horizon:'Next 4 days', description:'Wind speed and direction with animated particles.'
    }
  };

  const ECCC_LAYERS = {
    observedRadar: { title:'Live radar', category:'Precipitation', icon:'radio-tower', provider:'eccc', layer:'RADAR_1KM_RRAI', style:'RADARURPPRECIPR14-LINEAR', mode:'observed', horizon:'Past 3 hours', description:'Official ECCC 1 km observed radar.' },
    nowcast: { title:'Radar nowcast', category:'Precipitation', icon:'cloud-rain-wind', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR', mode:'forecast', horizon:'Short range', description:'Extrapolated precipitation based on observed radar.' },
    precipType: { title:'Observed precip type', category:'Precipitation', icon:'cloud-snow', provider:'eccc', layer:'Radar_1km_SfcPrecipType', mode:'observed', horizon:'Current / history', description:'Observed rain, snow and mixed precipitation.' },
    precipProb: { title:'Precipitation probability', category:'Precipitation', icon:'percent', provider:'eccc', layer:'HRDPS-WEonG_2.5km_Precip-Prob', mode:'forecast', horizon:'Canadian HRDPS', description:'High-resolution Canadian precipitation probability.' },
    rainAccum: { title:'Rain accumulation', category:'Precipitation', icon:'droplets', provider:'eccc', layer:'HRDPS.CONTINENTAL_RN', mode:'forecast', horizon:'Up to 48h', description:'Canadian high-resolution accumulated rainfall.' },

    lightning: { title:'Lightning density', category:'Storms', icon:'zap', provider:'eccc', layer:'Lightning_2.5km_Density', style:'Lightning', mode:'observed', horizon:'Recent', description:'Canadian lightning flash-density analysis.' },
    thunderRisk: { title:'Thunderstorm probability', category:'Storms', icon:'cloud-lightning', provider:'eccc', layer:'HRDPS-WEonG_2.5km_Thunderstorm-Prob', mode:'forecast', horizon:'Up to 48h', description:'High-resolution Canadian thunderstorm probability.' },
    showalter: { title:'Showalter index', category:'Storms', icon:'activity', provider:'eccc', layer:'HRDPS.CONTINENTAL.CONV_SHWINX.500', mode:'forecast', horizon:'Up to 48h', description:'Convective instability diagnostic.' },
    alerts: { title:'Official alerts', category:'Storms', icon:'triangle-alert', provider:'eccc', layer:'Current-Alerts', style:'Current-Alerts', mode:'current', horizon:'Current', description:'Environment Canada watches, warnings and advisories.' },

    clouds: { title:'Cloud cover', category:'Atmosphere', icon:'cloud', provider:'eccc', layer:'HRDPS.CONTINENTAL_NT', mode:'forecast', horizon:'Up to 48h', description:'High-resolution Canadian cloud-cover forecast.' },
    dewpoint: { title:'Dew point', category:'Atmosphere', icon:'droplet', provider:'eccc', layer:'HRDPS.CONTINENTAL_TD', mode:'forecast', horizon:'Up to 48h', description:'Canadian dew-point temperature forecast.' },
    humidity: { title:'Humidity', category:'Atmosphere', icon:'waves', provider:'eccc', layer:'HRDPS.CONTINENTAL_HR', mode:'forecast', horizon:'Up to 48h', description:'Canadian near-surface relative humidity.' },

    windGust: { title:'Wind gusts', category:'Wind', icon:'wind', provider:'eccc', layer:'HRDPS.CONTINENTAL_WGE', mode:'forecast', horizon:'Up to 48h', description:'Canadian high-resolution wind-gust forecast.' },

    snowAccum: { title:'Snow accumulation', category:'Winter', icon:'snowflake', provider:'eccc', layer:'HRDPS.CONTINENTAL_SN', mode:'forecast', horizon:'Up to 48h', description:'Canadian accumulated snowfall forecast.' },
    snowDepth: { title:'Snow depth', category:'Winter', icon:'ruler', provider:'eccc', layer:'HRDPS.CONTINENTAL_SD', mode:'forecast', horizon:'Up to 48h', description:'Canadian snow-depth forecast.' },
    freezingRain: { title:'Freezing rain', category:'Winter', icon:'cloud-hail', provider:'eccc', layer:'HRDPS.CONTINENTAL_FR', mode:'forecast', horizon:'Up to 48h', description:'Canadian freezing-rain accumulation forecast.' },
    modelPrecipType: { title:'Forecast precip type', category:'Winter', icon:'cloud-snow', provider:'eccc', layer:'HRDPS.CONTINENTAL.DIAG_PTYPE', mode:'forecast', horizon:'Up to 48h', description:'Model forecast precipitation type.' },

    aqhi: { title:'Air Quality Health Index', category:'Environment', icon:'lungs', provider:'eccc', layer:'AQHI-OBS', mode:'current', horizon:'Current', description:'Official Canadian Air Quality Health Index.' },
    smoke: { title:'Wildfire smoke PM2.5', category:'Environment', icon:'cloud-fog', provider:'eccc', layer:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', mode:'forecast', horizon:'Forecast', description:'Canadian wildfire-smoke PM2.5 plume guidance.' }
  };

  const defs = { ...MAPTILER_LAYERS, ...ECCC_LAYERS };
  const categories = ['Precipitation','Storms','Atmosphere','Wind','Winter','Environment'];

  let map = null;
  let container = null;
  let marker = null;
  let selected = localStorage.getItem(WEATHER_STORAGE) || 'observedRadar';
  if (!defs[selected]) selected = 'observedRadar';
  let baseStyle = localStorage.getItem(MAP_STYLE_STORAGE) || 'auto';
  if (!['auto','standard','light','dark','satellite','terrain'].includes(baseStyle)) baseStyle='auto';
  let themeChoice = localStorage.getItem(THEME_STORAGE) || 'system';
  if (!['system','dark','light'].includes(themeChoice)) themeChoice='system';
  let activeMapTilerLayer = null;
  let activeEcccSourceId = null;
  let activeEcccLayerId = null;
  let ecccTimes = [];
  let ecccIndex = 0;
  let ecccTimer = null;
  let playing = false;
  let styleChanging = false;
  let selectionToken = 0;
  let locationFingerprint = '';
  let valuePill = null;
  const metaCache = new Map();

  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizedTime = date => new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');

  function currentLocation() {
    try {
      const loc = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      return loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude)) ? loc : {name:'Calgary',latitude:51.0447,longitude:-114.0719};
    } catch (_) { return {name:'Calgary',latitude:51.0447,longitude:-114.0719}; }
  }

  function currentSettings() {
    try { return JSON.parse(localStorage.getItem('stormlens-settings') || '{}'); }
    catch (_) { return {}; }
  }

  function effectiveTheme() {
    if (themeChoice === 'dark' || themeChoice === 'light') return themeChoice;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme() {
    const resolved=effectiveTheme();
    document.documentElement.dataset.theme=resolved;
    document.documentElement.dataset.themeChoice=themeChoice;
    document.body.dataset.theme=resolved;
    $('#app')?.setAttribute('data-theme',resolved);
    const meta=$('meta[name="theme-color"]'); if(meta) meta.content=resolved==='light'?'#f5f7fa':'#070b12';
    const select=$('#stormlensThemeSelect'); if(select) select.value=themeChoice;
    if(baseStyle==='auto' && map) setBaseMap('auto',false);
  }

  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(themeChoice==='system')applyTheme();});

  function mapStyleObject(style=baseStyle) {
    const actual=style==='auto'?(effectiveTheme()==='light'?'light':'dark'):style;
    const S=maptilersdk.MapStyle;
    if(actual==='standard') return S.STREETS;
    if(actual==='light') return S.DATAVIZ.LIGHT;
    if(actual==='dark') return S.DATAVIZ.DARK;
    if(actual==='satellite') return S.HYBRID;
    if(actual==='terrain') return S.TOPO;
    return S.DATAVIZ.DARK;
  }

  function setBaseMap(style,persist=true) {
    if(!map || !['auto','standard','light','dark','satellite','terrain'].includes(style)) return;
    baseStyle=style;
    if(persist)localStorage.setItem(MAP_STYLE_STORAGE,style);
    const setting=$('#stormlensMapStyleSelect'); if(setting) setting.value=style;
    $$('.map-type-card').forEach(card=>card.classList.toggle('active',card.dataset.mapStyle===style));
    styleChanging=true;
    stopPlayback();
    map.setStyle(mapStyleObject(style));
  }

  function makeMapContainer() {
    const screen=$('#mapScreen');
    if(!screen) return null;
    let node=$('#stormlensMapV7');
    if(!node){
      node=document.createElement('div'); node.id='stormlensMapV7'; node.className='stormlens-map-v7';
      screen.insertBefore(node,screen.firstChild);
    }
    const legacy=$('#weatherMap');
    if(legacy){legacy.style.opacity='0';legacy.style.pointerEvents='none';}
    return node;
  }

  function ensureValuePill() {
    if(valuePill) return valuePill;
    const screen=$('#mapScreen'); if(!screen)return null;
    valuePill=document.createElement('div'); valuePill.className='v7-value-pill'; valuePill.hidden=true;
    screen.appendChild(valuePill); return valuePill;
  }

  function addLocationMarker() {
    if(!map) return;
    const loc=currentLocation();
    if(marker) marker.remove();
    const el=document.createElement('div'); el.className='v7-location-dot';
    marker=new maptilersdk.Marker({element:el,anchor:'center'}).setLngLat([Number(loc.longitude),Number(loc.latitude)]).addTo(map);
    locationFingerprint=`${Number(loc.latitude).toFixed(5)},${Number(loc.longitude).toFixed(5)}`;
  }

  function syncLocation() {
    if(!map)return;
    const loc=currentLocation();
    const fp=`${Number(loc.latitude).toFixed(5)},${Number(loc.longitude).toFixed(5)}`;
    if(fp===locationFingerprint)return;
    addLocationMarker();
    map.easeTo({center:[Number(loc.longitude),Number(loc.latitude)],zoom:7.5,duration:700,essential:true});
  }

  function firstLabelLayer() {
    const layers=map?.getStyle()?.layers || [];
    return layers.find(layer=>layer.type==='symbol' && layer.layout?.['text-field'])?.id;
  }

  function status(text,state='live') {
    const label=$('#mapLayerStatus'); if(label)label.textContent=text;
    const pill=$('#mapStatusPill'); if(pill){pill.dataset.state=state;pill.dataset.error=state==='error'?'true':'false';}
  }

  function renderLegend() {
    const def=defs[selected], legend=$('#radarLegend'), source=$('#radarSourceLine');
    if(!legend||!def)return;
    if(selected==='observedRadar'||selected==='nowcast'||selected==='forecastRadar') {
      legend.innerHTML='<span><b class="legend-dot v6-l1"></b>Light</span><span><b class="legend-dot v6-l2"></b>Moderate</span><span><b class="legend-dot v6-l3"></b>Heavy</span><span><b class="legend-dot v6-l4"></b>Very heavy</span><span><b class="legend-dot v6-l5"></b>Extreme</span>';
    } else if(def.provider==='maptiler') {
      legend.innerHTML=`<span class="v7-legend-text">${esc(def.title)} · smooth WebGL interpolation</span>`;
    } else {
      legend.innerHTML=`<span class="v7-legend-text">${esc(def.title)} · ECCC</span>`;
    }
    if(source) source.textContent=def.provider==='maptiler' ? `${def.title} · MapTiler Weather · ${def.horizon}` : `${def.title} · Environment and Climate Change Canada GeoMet · ${def.horizon}`;
  }

  function speedFactor() {
    const value=Number(currentSettings().radarSpeed || 650);
    if(value>=1000)return 1800;
    if(value>=500)return 3600;
    if(value>=250)return 7200;
    return 14400;
  }

  function stopPlayback() {
    playing=false;
    if(ecccTimer){clearTimeout(ecccTimer);ecccTimer=null;}
    try{activeMapTilerLayer?.animateByFactor?.(0);}catch(_){}
    const button=$('#radarPlay'); if(button)button.innerHTML='<i data-lucide="play"></i>';
    refreshIcons();
  }

  function timelineModeText(def) {
    if(def.provider==='maptiler') return 'FORECAST · 4 DAYS';
    if(def.mode==='observed')return 'OBSERVED';
    if(def.mode==='forecast')return 'FORECAST';
    return 'CURRENT';
  }

  function updateTimeText(date,start,end) {
    const stamp=$('#radarTimestamp'), mode=$('#radarModeLabel'), left=$('#timelineStartLabel'), right=$('#timelineNowLabel');
    const def=defs[selected];
    if(mode)mode.textContent=timelineModeText(def);
    if(stamp)stamp.textContent=date?date.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Latest available';
    if(left) left.textContent=start ? new Date(start).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : (def.mode==='observed'?'PAST':'NOW');
    if(right) right.textContent=end ? new Date(end).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : def.horizon.toUpperCase();
  }

  function configureRange(minMs,maxMs,valueMs) {
    const range=$('#radarTimeline'); if(!range)return;
    range.disabled=!(Number.isFinite(minMs)&&Number.isFinite(maxMs)&&maxMs>minMs);
    if(range.disabled){range.min='0';range.max='1';range.value='0';return;}
    range.min=String(Math.round(minMs)); range.max=String(Math.round(maxMs)); range.step=String(15*60*1000); range.value=String(Math.round(valueMs));
  }

  function mapTilerConstructor(type) {
    if(type==='radar')return maptilerweather.RadarLayer;
    if(type==='precipitation')return maptilerweather.PrecipitationLayer;
    if(type==='temperature')return maptilerweather.TemperatureLayer;
    if(type==='pressure')return maptilerweather.PressureLayer;
    if(type==='wind')return maptilerweather.WindLayer;
    return null;
  }

  function weatherOptions(def) {
    const opacity=Math.max(.25,Math.min(1,Number(currentSettings().radarOpacity||78)/100));
    const base={id:`stormlens-${def.type}`,opacity,smooth:true};
    if(def.type==='wind')return {...base,density:160,size:1.35,speed:.0013};
    if(def.type==='temperature' && maptilerweather.ColorRamp?.builtin?.TEMPERATURE_3) base.colorramp=maptilerweather.ColorRamp.builtin.TEMPERATURE_3;
    return base;
  }

  function removeActiveWeather() {
    stopPlayback();
    if(activeMapTilerLayer && map){
      try{map.removeLayer(activeMapTilerLayer.id);}catch(_){try{map.removeLayer(activeMapTilerLayer);}catch(__){}}
    }
    activeMapTilerLayer=null;
    if(activeEcccLayerId && map?.getLayer(activeEcccLayerId)){try{map.removeLayer(activeEcccLayerId);}catch(_){}}
    if(activeEcccSourceId && map?.getSource(activeEcccSourceId)){try{map.removeSource(activeEcccSourceId);}catch(_){}}
    activeEcccLayerId=null;activeEcccSourceId=null;ecccTimes=[];ecccIndex=0;
    if(valuePill)valuePill.hidden=true;
  }

  async function activateMapTiler(id,token) {
    const def=defs[id], Constructor=mapTilerConstructor(def.type);
    if(!Constructor)throw new Error('Unsupported MapTiler weather layer');
    const layer=new Constructor(weatherOptions(def));
    activeMapTilerLayer=layer;
    const before=firstLabelLayer();
    if(before) map.addLayer(layer,before); else map.addLayer(layer);
    await layer.onSourceReadyAsync();
    if(token!==selectionToken||selected!==id)return;
    const start=layer.getAnimationStartDate(), end=layer.getAnimationEndDate(), now=Date.now();
    const current=new Date(Math.min(+end,Math.max(+start,now)));
    layer.setAnimationTime(Math.round(+current/1000));
    configureRange(+start,+end,+current);
    updateTimeText(current,+start,+end);
    layer.on('tick',()=>{
      if(selected!==id)return;
      const date=layer.getAnimationTimeDate();
      const range=$('#radarTimeline'); if(range&&!range.matches(':active'))range.value=String(+date);
      updateTimeText(date,+start,+end);
    });
    layer.on('animationTimeSet',()=>{if(selected===id)updateMapValueAtCenter();});
    status(`${def.title} · LIVE`,'live');
    renderLegend();
    renderLayerSelection();
  }

  function parseDuration(value) {
    const m=String(value||'').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if(!m)return 360000;
    return (((Number(m[1]||0)*24+Number(m[2]||0))*60+Number(m[3]||0))*60+Number(m[4]||0))*1000||360000;
  }

  function parseTimes(text) {
    if(!text)return[];
    const out=[];
    for(const part of String(text).split(',').map(v=>v.trim()).filter(Boolean)){
      if(!part.includes('/')){const d=new Date(part);if(!Number.isNaN(+d))out.push(d);continue;}
      const [a,b,p]=part.split('/'),start=new Date(a),end=new Date(b),step=parseDuration(p);
      if(Number.isNaN(+start)||Number.isNaN(+end)||step<=0)continue;
      for(let t=+start,g=0;t<=+end&&g<2500;t+=step,g++)out.push(new Date(t));
    }
    return [...new Map(out.map(d=>[d.toISOString(),d])).values()].sort((a,b)=>a-b);
  }

  function directChild(node,name){return [...(node?.children||[])].find(child=>child.localName===name||child.tagName===name);}

  async function ecccMeta(id) {
    if(metaCache.has(id))return metaCache.get(id);
    const def=defs[id];
    try{
      const params=new URLSearchParams({service:'WMS',version:'1.3.0',request:'GetCapabilities',layer:def.layer,_:String(Date.now())});
      const res=await fetch(`${WMS}${params}`,{cache:'no-store'}); if(!res.ok)throw new Error(`GeoMet ${res.status}`);
      const xml=new DOMParser().parseFromString(await res.text(),'application/xml');
      const node=[...xml.querySelectorAll('Layer')].find(n=>directChild(n,'Name')?.textContent?.trim()===def.layer);
      if(!node)throw new Error('Layer unavailable');
      const timeNode=[...node.children].find(child=>(child.localName==='Dimension'||child.localName==='Extent')&&child.getAttribute('name')==='time');
      const meta={times:parseTimes(timeNode?.textContent?.trim()||'')}; metaCache.set(id,meta); return meta;
    }catch(error){return{times:[],error:error.message};}
  }

  function preferredEcccIndex(def,times){
    if(!times.length)return 0; const now=Date.now();
    if(def.mode==='observed'){let idx=0;times.forEach((d,i)=>{if(+d<=now+120000)idx=i;});return idx;}
    let idx=0,best=Infinity;times.forEach((d,i)=>{const delta=Math.abs(+d-now);if(delta<best){best=delta;idx=i;}});return idx;
  }

  function ecccTileUrl(def,date) {
    const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:def.layer,STYLES:def.style||'',FORMAT:'image/png',TRANSPARENT:'true',SRS:'EPSG:3857',WIDTH:'512',HEIGHT:'512'});
    if(date)params.set('TIME',normalizedTime(date));
    return `${WMS}${params.toString()}&BBOX={bbox-epsg-3857}`;
  }

  function updateEcccSource(date) {
    if(!activeEcccSourceId||!map)return;
    const source=map.getSource(activeEcccSourceId), def=defs[selected];
    if(source?.setTiles)source.setTiles([ecccTileUrl(def,date)]);
    updateTimeText(date,ecccTimes[0],ecccTimes[ecccTimes.length-1]);
  }

  async function activateEccc(id,token) {
    const def=defs[id], meta=await ecccMeta(id);
    if(token!==selectionToken||selected!==id)return;
    ecccTimes=meta.times||[]; ecccIndex=preferredEcccIndex(def,ecccTimes);
    const sourceId=`stormlens-eccc-source`,layerId=`stormlens-eccc-layer`;
    activeEcccSourceId=sourceId;activeEcccLayerId=layerId;
    const date=ecccTimes[ecccIndex];
    map.addSource(sourceId,{type:'raster',tiles:[ecccTileUrl(def,date)],tileSize:512,attribution:'Environment and Climate Change Canada'});
    const before=firstLabelLayer();
    const layerSpec={id:layerId,type:'raster',source:sourceId,paint:{'raster-opacity':Math.max(.25,Math.min(1,Number(currentSettings().radarOpacity||78)/100)),'raster-resampling':'linear','raster-fade-duration':180}};
    if(before)map.addLayer(layerSpec,before);else map.addLayer(layerSpec);
    if(ecccTimes.length>1){
      configureRange(+ecccTimes[0],+ecccTimes[ecccTimes.length-1],+date);
      updateTimeText(date,+ecccTimes[0],+ecccTimes[ecccTimes.length-1]);
    }else{
      configureRange(0,0,0);updateTimeText(date||null,null,null);
    }
    status(`${def.title} · LIVE`,'live');renderLegend();renderLayerSelection();
  }

  async function selectLayer(id,{quiet=false}={}) {
    if(!defs[id]||!map||styleChanging)return;
    selectionToken+=1;const token=selectionToken;
    removeActiveWeather(); selected=id;localStorage.setItem(WEATHER_STORAGE,id);
    status(`${defs[id].title} · loading`,'loading');syncQuickButtons();renderLayerSelection();renderLegend();
    try{
      if(defs[id].provider==='maptiler')await activateMapTiler(id,token);else await activateEccc(id,token);
    }catch(error){
      console.warn('[StormLens V7 layer]',id,error);status(`${defs[id].title} · unavailable`,'error');
    }
    if(!quiet)closeLayers();
  }

  function formatPickedValue(id,value) {
    if(!value)return'';
    if(id==='forecastRadar'&&Number.isFinite(value.value))return `${value.value.toFixed(0)} dBZ`;
    if(id==='precipitation'&&Number.isFinite(value.value))return `${value.value.toFixed(1)} mm/h`;
    if(id==='temperature'&&Number.isFinite(value.value))return `${value.value.toFixed(1)} °C`;
    if(id==='pressure'&&Number.isFinite(value.value))return `${value.value.toFixed(0)} hPa`;
    if(id==='wind'&&Number.isFinite(value.speedKilometersPerHour))return `${value.compassDirection||''} ${value.speedKilometersPerHour.toFixed(1)} km/h`.trim();
    return'';
  }

  function showPickedValue(lngLat) {
    const pill=ensureValuePill(); if(!pill||!activeMapTilerLayer||defs[selected].provider!=='maptiler'){if(pill)pill.hidden=true;return;}
    try{
      const value=activeMapTilerLayer.pickAt(lngLat.lng,lngLat.lat),text=formatPickedValue(selected,value);
      if(!text){pill.hidden=true;return;}
      pill.innerHTML=`<span>${esc(defs[selected].title)}</span><strong>${esc(text)}</strong>`;pill.hidden=false;
    }catch(_){pill.hidden=true;}
  }

  function updateMapValueAtCenter(){if(map)showPickedValue(map.getCenter());}

  function playEccc() {
    if(!playing||ecccTimes.length<2)return;
    ecccIndex+=1;
    if(ecccIndex>=ecccTimes.length)ecccIndex=defs[selected].mode==='observed'?Math.max(0,ecccTimes.length-20):0;
    const date=ecccTimes[ecccIndex];updateEcccSource(date);const range=$('#radarTimeline');if(range)range.value=String(+date);
    const delay=Math.max(280,Number(currentSettings().radarSpeed||650));ecccTimer=setTimeout(playEccc,delay);
  }

  function togglePlayback() {
    if(playing){stopPlayback();return;}
    playing=true;const button=$('#radarPlay');if(button)button.innerHTML='<i data-lucide="pause"></i>';refreshIcons();
    if(defs[selected].provider==='maptiler'){
      activeMapTilerLayer?.animateByFactor?.(speedFactor());
    }else playEccc();
  }

  function step(direction) {
    stopPlayback();
    if(defs[selected].provider==='maptiler'&&activeMapTilerLayer){
      const start=+activeMapTilerLayer.getAnimationStartDate(),end=+activeMapTilerLayer.getAnimationEndDate(),current=+activeMapTilerLayer.getAnimationTimeDate();
      const next=Math.min(end,Math.max(start,current+direction*60*60*1000));activeMapTilerLayer.setAnimationTime(Math.round(next/1000));const range=$('#radarTimeline');if(range)range.value=String(next);updateTimeText(new Date(next),start,end);
    }else if(ecccTimes.length){ecccIndex=Math.min(ecccTimes.length-1,Math.max(0,ecccIndex+direction));updateEcccSource(ecccTimes[ecccIndex]);const range=$('#radarTimeline');if(range)range.value=String(+ecccTimes[ecccIndex]);}
  }

  function bindTimelineControls() {
    const range=$('#radarTimeline'),play=$('#radarPlay'),back=$('#radarStepBack'),forward=$('#radarStepForward');
    if(!range||range.dataset.v7Bound)return;range.dataset.v7Bound='true';
    range.addEventListener('input',event=>{
      event.preventDefault();event.stopImmediatePropagation();stopPlayback();const ms=Number(range.value);
      if(defs[selected].provider==='maptiler'&&activeMapTilerLayer){activeMapTilerLayer.setAnimationTime(Math.round(ms/1000));updateTimeText(new Date(ms),+activeMapTilerLayer.getAnimationStartDate(),+activeMapTilerLayer.getAnimationEndDate());}
      else if(ecccTimes.length){let best=0,delta=Infinity;ecccTimes.forEach((d,i)=>{const x=Math.abs(+d-ms);if(x<delta){delta=x;best=i;}});ecccIndex=best;updateEcccSource(ecccTimes[best]);}
    },true);
    play?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();togglePlayback();},true);
    back?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();step(-1);},true);
    forward?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();step(1);},true);
  }

  function syncQuickButtons() {
    const quickMap={radar:'observedRadar',nowcast:'nowcast',lightning:'lightning',storms:'thunderRisk',alerts:'alerts'};
    Object.entries(quickMap).forEach(([quick,id])=>$('#quickLayers [data-layer="'+quick+'"]')?.classList.toggle('active',selected===id));
  }

  function bindQuickControls() {
    const rail=$('#quickLayers');if(!rail||rail.dataset.v7Bound)return;rail.dataset.v7Bound='true';
    rail.addEventListener('click',event=>{
      const button=event.target.closest('[data-layer]');if(!button)return;const key=button.dataset.layer;if(!['radar','nowcast','lightning','storms','alerts','layers'].includes(key))return;
      event.preventDefault();event.stopImmediatePropagation();if(key==='layers')return openLayers();
      selectLayer({radar:'observedRadar',nowcast:'nowcast',lightning:'lightning',storms:'thunderRisk',alerts:'alerts'}[key]);
    },true);
    $('#recenterBtn')?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const loc=currentLocation();map?.easeTo({center:[Number(loc.longitude),Number(loc.latitude)],zoom:8,duration:700,essential:true});},true);
  }

  function mapTypeCards() {
    const items={auto:['Auto','Follows app theme','auto'],standard:['Standard','Roads + labels','standard'],light:['Light','Bright + clean','light'],dark:['Dark','Low-light weather','dark'],satellite:['Satellite','Imagery + labels','satellite'],terrain:['Terrain','Topo + terrain','terrain']};
    return Object.entries(items).map(([id,[title,sub,preview]])=>`<button class="map-type-card ${baseStyle===id?'active':''}" data-map-style="${id}"><span class="map-type-preview preview-${preview}"></span><strong>${title}</strong><small>${sub}</small></button>`).join('');
  }

  function layerRows() {
    return categories.map(category=>{
      const rows=Object.entries(defs).filter(([,def])=>def.category===category).map(([id,def])=>`<button class="v6-layer-row ${selected===id?'active':''}" data-v7-weather="${id}"><span class="v6-layer-icon"><i data-lucide="${def.icon}"></i></span><span class="v6-layer-copy"><strong>${esc(def.title)}</strong><small>${esc(def.description)} · ${esc(def.horizon)}</small></span><span class="v6-radio"><b></b></span></button>`).join('');
      return `<section class="v6-layer-group"><h3>${category}</h3>${rows}</section>`;
    }).join('');
  }

  function buildLayerSheet() {
    const sheet=$('#layersModal .layer-sheet');if(!sheet)return;
    sheet.innerHTML=`<div class="sheet-handle"></div><div class="sheet-title-row"><div><span class="eyebrow">MAP</span><h2>Map layers</h2></div><button class="icon-button v7-close-layers" aria-label="Close"><i data-lucide="x"></i></button></div><section class="v6-map-type-section"><div class="v6-section-head"><div><span class="eyebrow">BASE MAP</span><h3>Map type</h3></div><small>MapTiler vector + satellite maps</small></div><div class="map-type-grid">${mapTypeCards()}</div></section><section class="v6-weather-section"><div class="v6-section-head"><div><span class="eyebrow">WEATHER</span><h3>Weather layer</h3></div><small>One active layer at a time</small></div><div class="v6-selected-summary"><span class="health-dot live"></span><strong id="v7SelectedLayerName">${esc(defs[selected].title)}</strong><span>${esc(defs[selected].horizon)}</span></div><div class="v6-layer-groups">${layerRows()}</div></section>`;
    sheet.querySelector('.v7-close-layers')?.addEventListener('click',closeLayers);
    sheet.querySelectorAll('[data-map-style]').forEach(btn=>btn.addEventListener('click',()=>setBaseMap(btn.dataset.mapStyle)));
    sheet.querySelectorAll('[data-v7-weather]').forEach(btn=>btn.addEventListener('click',()=>selectLayer(btn.dataset.v7Weather)));
    refreshIcons();
  }

  function renderLayerSelection() {
    $$('[data-v7-weather]').forEach(row=>row.classList.toggle('active',row.dataset.v7Weather===selected));
    const label=$('#v7SelectedLayerName');if(label)label.textContent=defs[selected].title;
    const summary=$('.v6-selected-summary span:last-child');if(summary)summary.textContent=defs[selected].horizon;
  }
  function openLayers(){buildLayerSheet();const modal=$('#layersModal');if(modal)modal.hidden=false;refreshIcons();}
  function closeLayers(){const modal=$('#layersModal');if(modal)modal.hidden=true;}

  function injectSettings() {
    const list=$('#settingsModal .settings-list');if(!list)return;
    if(!$('#stormlensThemeSelect')){
      const theme=document.createElement('div');theme.className='setting-row';theme.innerHTML='<span><strong>Appearance</strong><small>App theme</small></span><select id="stormlensThemeSelect"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select>';list.insertBefore(theme,list.firstChild?.nextSibling||list.firstChild);
      $('#stormlensThemeSelect').value=themeChoice;$('#stormlensThemeSelect').addEventListener('change',event=>{themeChoice=event.target.value;localStorage.setItem(THEME_STORAGE,themeChoice);applyTheme();});
    }
    if(!$('#stormlensMapStyleSelect')){
      const row=document.createElement('div');row.className='setting-row';row.innerHTML='<span><strong>Default map</strong><small>MapTiler basemap</small></span><select id="stormlensMapStyleSelect"><option value="auto">Auto</option><option value="standard">Standard</option><option value="light">Light</option><option value="dark">Dark</option><option value="satellite">Satellite</option><option value="terrain">Terrain</option></select>';list.insertBefore(row,list.firstChild?.nextSibling||list.firstChild);$('#stormlensMapStyleSelect').value=baseStyle;$('#stormlensMapStyleSelect').addEventListener('change',event=>setBaseMap(event.target.value));
    }
    $('#radarOpacity')?.addEventListener('input',()=>{
      const opacity=Math.max(.25,Math.min(1,Number(currentSettings().radarOpacity||78)/100));
      try{activeMapTilerLayer?.setOpacity?.(opacity);}catch(_){}
      if(activeEcccLayerId&&map?.getLayer(activeEcccLayerId))map.setPaintProperty(activeEcccLayerId,'raster-opacity',opacity);
    });
  }

  function refreshIcons(){if(window.lucide)requestAnimationFrame(()=>window.lucide.createIcons());}

  function handleStyleLoad() {
    if(!map)return;
    styleChanging=false;addLocationMarker();
    const id=selected;setTimeout(()=>selectLayer(id,{quiet:true}),50);
  }

  function initialize() {
    if(map)return;
    container=makeMapContainer();if(!container)return;
    const loc=currentLocation();
    map=new maptilersdk.Map({container,style:mapStyleObject(baseStyle),center:[Number(loc.longitude),Number(loc.latitude)],zoom:7.2,attributionControl:true,navigationControl:false,terrainControl:false});
    window.StormLensMapV7=api;
    map.on('load',()=>{
      addLocationMarker();bindTimelineControls();bindQuickControls();injectSettings();buildLayerSheet();renderLegend();selectLayer(selected,{quiet:true});
      setInterval(syncLocation,1200);
    });
    map.on('style.load',()=>{if(styleChanging)handleStyleLoad();});
    map.on('click',event=>showPickedValue(event.lngLat));
    map.on('mousemove',event=>{if(defs[selected]?.provider==='maptiler'&&!matchMedia('(pointer:coarse)').matches)showPickedValue(event.lngLat);});
  }

  const api={
    get map(){return map;},get selectedLayer(){return selected;},defs,selectLayer,setBaseMap,openLayers,stopPlayback,
    setTheme(choice){themeChoice=choice;localStorage.setItem(THEME_STORAGE,choice);applyTheme();}
  };
  window.StormLensPremiumOverlays={get map(){return map;},selectLayer,toggleLayer(id,force){if(force===false&&selected===id)return;return selectLayer(id);},applyPreset(name){return selectLayer(name==='storm'?'thunderRisk':name==='winter'?'snowAccum':name==='smoke'?'smoke':'observedRadar');}};

  applyTheme();injectSettings();bindTimelineControls();bindQuickControls();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
