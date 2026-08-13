(() => {
  'use strict';

  const ALERTS_API='https://api.weather.gc.ca/collections/weather-alerts/items';
  const $=q=>document.querySelector(q);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let forecastCache=null;
  let forecastSignature='';
  let alertCache=[];
  let alertsFetchedAt=null;
  let locationSignature='';
  let alertTimer=null;

  function refreshIcons(){ if(window.lucide) requestAnimationFrame(()=>window.lucide.createIcons()); }
  function settings(){ try{return JSON.parse(localStorage.getItem('stormlens-settings')||'{}')||{};}catch(_){return{};} }
  function locationState(){
    try{
      const loc=JSON.parse(localStorage.getItem('stormlens-location')||'null');
      if(loc&&Number.isFinite(Number(loc.latitude))&&Number.isFinite(Number(loc.longitude))) return loc;
    }catch(_){}
    return {name:'Calgary',admin1:'Alberta',country:'Canada',countryCode:'CA',provinceCode:'AB',latitude:51.0447,longitude:-114.0719};
  }
  function locSig(){const l=locationState();return `${Number(l.latitude).toFixed(4)},${Number(l.longitude).toFixed(4)}`;}
  function provinceCode(name){
    return ({'alberta':'AB','british columbia':'BC','manitoba':'MB','new brunswick':'NB','newfoundland and labrador':'NL','northwest territories':'NT','nova scotia':'NS','nunavut':'NU','ontario':'ON','prince edward island':'PE','quebec':'QC','saskatchewan':'SK','yukon':'YT'})[String(name||'').trim().toLowerCase()]||'';
  }
  function windUnit(){return ({kmh:'km/h',mph:'mph',kn:'kt',ms:'m/s'})[settings().windUnit]||'km/h';}
  function tempUnit(){return settings().tempUnit==='fahrenheit'?'fahrenheit':'celsius';}
  function round(v){return Number.isFinite(Number(v))?Math.round(Number(v)):'—';}
  function average(values){const valid=values.map(Number).filter(Number.isFinite);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:NaN;}
  function formatTime(v){if(!v)return'—';return new Date(v).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});}
  function formatHour(v){return new Date(v).toLocaleTimeString(undefined,{hour:'numeric'}).replace(' ','');}
  function formatDuration(seconds){if(!Number.isFinite(Number(seconds)))return'—';const h=Math.floor(Number(seconds)/3600),m=Math.round((Number(seconds)%3600)/60);return `${h}h ${m}m`;}
  function formatVisibility(m){if(!Number.isFinite(Number(m)))return'—';return Number(m)>=10000?`${Math.round(Number(m)/1000)} km`:`${(Number(m)/1000).toFixed(1)} km`;}
  function compass(deg){if(!Number.isFinite(Number(deg)))return'—';const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];return dirs[Math.round((((Number(deg)%360)+360)%360)/22.5)%16];}
  function uvLabel(v){const n=Number(v);return n<3?'Low':n<6?'Moderate':n<8?'High':n<11?'Very high':'Extreme';}

  function condition(code){
    const map={0:['Clear','sun'],1:['Mostly clear','sun'],2:['Partly cloudy','cloud-sun'],3:['Overcast','cloud'],45:['Fog','cloud-fog'],48:['Rime fog','cloud-fog'],51:['Light drizzle','cloud-drizzle'],53:['Drizzle','cloud-drizzle'],55:['Heavy drizzle','cloud-rain'],56:['Freezing drizzle','cloud-hail'],57:['Freezing drizzle','cloud-hail'],61:['Light rain','cloud-rain'],63:['Rain','cloud-rain'],65:['Heavy rain','cloud-rain-wind'],66:['Freezing rain','cloud-hail'],67:['Freezing rain','cloud-hail'],71:['Light snow','cloud-snow'],73:['Snow','cloud-snow'],75:['Heavy snow','snowflake'],77:['Snow grains','snowflake'],80:['Rain showers','cloud-rain'],81:['Rain showers','cloud-rain-wind'],82:['Heavy showers','cloud-rain-wind'],85:['Snow showers','cloud-snow'],86:['Heavy snow showers','snowflake'],95:['Thunderstorm','cloud-lightning'],96:['Thunderstorm + hail','cloud-lightning'],99:['Severe thunderstorm','cloud-lightning']};
    const [label,icon]=map[Number(code)]||['Variable','cloud'];return{label,icon};
  }

  function ensureSheets(){
    if(!$('#v12DayDetail')){
      document.body.insertAdjacentHTML('beforeend',`<div class="v12-backdrop" id="v12DayDetail" hidden><section class="v12-sheet" role="dialog" aria-modal="true" aria-labelledby="v12DayTitle"><div class="v12-sheet-handle"></div><header class="v12-sheet-head"><div><span class="eyebrow">DAILY FORECAST</span><h2 id="v12DayTitle">Day details</h2><p id="v12DaySubtitle"></p></div><button class="v12-close" data-v12-close="v12DayDetail" aria-label="Close day details"><i data-lucide="x"></i></button></header><div class="v12-sheet-body" id="v12DayBody"></div></section></div>`);
    }
    if(!$('#v12Alerts')){
      document.body.insertAdjacentHTML('beforeend',`<div class="v12-backdrop" id="v12Alerts" hidden><section class="v12-sheet" role="dialog" aria-modal="true" aria-labelledby="v12AlertsTitle"><div class="v12-sheet-handle"></div><header class="v12-sheet-head"><div><span class="eyebrow">OFFICIAL WEATHER</span><h2 id="v12AlertsTitle">Government alerts</h2><p id="v12AlertsSubtitle"></p></div><button class="v12-close" data-v12-close="v12Alerts" aria-label="Close official alerts"><i data-lucide="x"></i></button></header><div class="v12-sheet-body" id="v12AlertsBody"></div></section></div>`);
    }
    document.querySelectorAll('[data-v12-close]').forEach(button=>{if(button.dataset.v12Bound)return;button.dataset.v12Bound='1';button.addEventListener('click',()=>closeSheet(button.dataset.v12Close));});
    document.querySelectorAll('.v12-backdrop').forEach(backdrop=>{if(backdrop.dataset.v12BackdropBound)return;backdrop.dataset.v12BackdropBound='1';backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeSheet(backdrop.id);});});
    refreshIcons();
  }
  function openSheet(id){ensureSheets();const el=$('#'+id);if(!el)return;el.hidden=false;document.body.style.overflow='hidden';refreshIcons();}
  function closeSheet(id){const el=$('#'+id);if(el)el.hidden=true;if([...document.querySelectorAll('.v12-backdrop')].every(x=>x.hidden))document.body.style.overflow='';}

  async function loadForecast(){
    const loc=locationState(),s=settings();
    const sig=`${locSig()}:${s.tempUnit||'celsius'}:${s.windUnit||'kmh'}`;
    if(forecastCache&&forecastSignature===sig)return forecastCache;
    const params=new URLSearchParams({
      latitude:String(loc.latitude),longitude:String(loc.longitude),timezone:'auto',forecast_days:'16',
      temperature_unit:tempUnit(),wind_speed_unit:s.windUnit||'kmh',
      hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cape,visibility',
      daily:'weather_code,temperature_2m_max,temperature_2m_mean,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,shortwave_radiation_sum'
    });
    const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`Forecast service returned ${response.status}`);
    const data=await response.json();if(data.error)throw new Error(data.reason||'Forecast unavailable');
    forecastCache=data;forecastSignature=sig;return data;
  }

  function hourlyIndicesForDate(data,date){const indices=[];data.hourly.time.forEach((t,i)=>{if(String(t).slice(0,10)===date)indices.push(i);});return indices;}
  function dayExpectation(data,index,hourIndices){
    const d=data.daily,cond=condition(d.weather_code[index]);
    const chance=Number(d.precipitation_probability_max?.[index]||0),amount=Number(d.precipitation_sum?.[index]||0),gust=Number(d.wind_gusts_10m_max?.[index]||0),uv=Number(d.uv_index_max?.[index]||0);
    const capes=hourIndices.map(i=>Number(data.hourly.cape?.[i]||0));const maxCape=Math.max(0,...capes.filter(Number.isFinite));
    const codes=hourIndices.map(i=>Number(data.hourly.weather_code?.[i]||0));const thunder=codes.some(c=>c>=95)||maxCape>=800;
    const pieces=[`${cond.label} is the dominant forecast.`];
    if(chance>=60)pieces.push(`${chance.toFixed(0)}% precipitation chance with about ${amount.toFixed(1)} mm expected.`);else if(chance>=30)pieces.push(`There is a ${chance.toFixed(0)}% chance of precipitation.`);else pieces.push('Precipitation risk is low.');
    if(thunder)pieces.push(maxCape>=1200?'Thunderstorm ingredients are elevated.':'Some thunderstorm potential is present.');
    if(gust>=40)pieces.push(`Gusts may reach ${Math.round(gust)} ${windUnit()}.`);
    if(uv>=6)pieces.push(`UV reaches ${uv.toFixed(0)} (${uvLabel(uv)}).`);
    return pieces.join(' ');
  }

  async function showDay(index){
    ensureSheets();openSheet('v12DayDetail');
    const body=$('#v12DayBody');body.innerHTML='<div class="v12-empty"><i data-lucide="loader-circle"></i><div>Loading detailed forecast…</div></div>';refreshIcons();
    try{
      const data=await loadForecast(),d=data.daily;if(index<0||index>=d.time.length)throw new Error('That forecast day is unavailable.');
      const date=d.time[index],dateObj=new Date(date+'T12:00');const hourIndices=hourlyIndicesForDate(data,date);
      const humidity=hourIndices.map(i=>data.hourly.relative_humidity_2m?.[i]);const dew=hourIndices.map(i=>data.hourly.dew_point_2m?.[i]);const pressure=hourIndices.map(i=>Number(data.hourly.pressure_msl?.[i])).filter(Number.isFinite);const clouds=hourIndices.map(i=>data.hourly.cloud_cover?.[i]);const visibility=hourIndices.map(i=>Number(data.hourly.visibility?.[i])).filter(Number.isFinite);const cape=hourIndices.map(i=>Number(data.hourly.cape?.[i])).filter(Number.isFinite);
      const cond=condition(d.weather_code[index]);const sunshine=Number(d.sunshine_duration?.[index]||0),daylight=Number(d.daylight_duration?.[index]||0),sunPct=daylight>0?Math.max(0,Math.min(100,(sunshine/daylight)*100)):0;
      $('#v12DayTitle').textContent=index===0?'Today':dateObj.toLocaleDateString(undefined,{weekday:'long'});
      $('#v12DaySubtitle').textContent=`${dateObj.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})} · ${locationState().name}`;
      const snapshots=hourIndices.filter((_,j)=>j%3===0).map(i=>{const c=condition(data.hourly.weather_code[i]);return `<div class="v12-hour"><time>${escapeHtml(formatHour(data.hourly.time[i]))}</time><i data-lucide="${c.icon}"></i><strong>${round(data.hourly.temperature_2m[i])}°</strong><small>${escapeHtml(c.label)}</small><div class="rain">${round(data.hourly.precipitation_probability?.[i]||0)}% precip</div></div>`;}).join('');
      body.innerHTML=`
        <div class="v12-day-hero"><div><div class="v12-day-temp">${round(d.temperature_2m_max[index])}° <span>${round(d.temperature_2m_min[index])}°</span></div><div class="v12-day-condition">${escapeHtml(cond.label)} · feels ${round(d.apparent_temperature_max[index])}° / ${round(d.apparent_temperature_min[index])}°</div></div><div class="v12-day-icon"><i data-lucide="${cond.icon}"></i></div></div>
        <p class="v12-expectation">${escapeHtml(dayExpectation(data,index,hourIndices))}</p>
        <div class="v12-metric-grid">
          ${metric('Precipitation',`${round(d.precipitation_probability_max[index]||0)}%`,`${Number(d.precipitation_sum[index]||0).toFixed(1)} mm total · ${Number(d.precipitation_hours?.[index]||0).toFixed(0)}h`) }
          ${metric('Wind',`${round(d.wind_speed_10m_max[index])} ${windUnit()}`,`Gusts ${round(d.wind_gusts_10m_max[index])} ${windUnit()} · ${compass(d.wind_direction_10m_dominant[index])}`)}
          ${metric('Humidity',`${round(average(humidity))}%`,`Dew point ${round(average(dew))}°`)}
          ${metric('UV index',`${round(d.uv_index_max[index]||0)}`,uvLabel(d.uv_index_max[index]||0))}
          ${metric('Cloud cover',`${round(average(clouds))}%`,hourIndices.length?'Daily average':'Unavailable')}
          ${metric('Pressure',pressure.length?`${round(average(pressure))} hPa`:'—',pressure.length?`${round(Math.min(...pressure))}–${round(Math.max(...pressure))} hPa`:'Unavailable')}
          ${metric('Visibility',visibility.length?formatVisibility(Math.min(...visibility)):'—','Lowest forecast visibility')}
          ${metric('Storm energy',cape.length?`${round(Math.max(...cape))} J/kg`:'—','Maximum CAPE')}
        </div>
        <section class="v12-section"><div class="v12-section-title"><h3>Sun & daylight</h3><small>${formatDuration(daylight)} daylight</small></div><div class="v12-sun-track"><b style="width:${sunPct.toFixed(0)}%"></b></div><div class="v12-sun-times"><span>Sunrise ${escapeHtml(formatTime(d.sunrise[index]))}</span><span>${formatDuration(sunshine)} sunshine</span><span>Sunset ${escapeHtml(formatTime(d.sunset[index]))}</span></div></section>
        <section class="v12-section"><div class="v12-section-title"><h3>Through the day</h3><small>3-hour snapshots</small></div><div class="v12-hourly">${snapshots}</div></section>
        <div class="v12-source">Forecast detail uses the same Open-Meteo forecast family as StormLens. Values are model guidance and can change as newer runs arrive.</div>`;
      refreshIcons();
    }catch(error){body.innerHTML=`<div class="v12-empty"><i data-lucide="triangle-alert"></i><strong>Day details unavailable</strong><div>${escapeHtml(error.message||'Could not load this day.')}</div></div>`;refreshIcons();}
  }

  function metric(label,value,sub){return `<div class="v12-metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><p>${escapeHtml(sub)}</p></div>`;}

  function pointInGeometry(geometry,[x,y]){
    if(!geometry)return false;
    const inRing=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];const intersect=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);if(intersect)inside=!inside;}return inside;};
    const inPolygon=poly=>poly?.length&&inRing(poly[0])&&!poly.slice(1).some(inRing);
    if(geometry.type==='Polygon')return inPolygon(geometry.coordinates);
    if(geometry.type==='MultiPolygon')return geometry.coordinates.some(inPolygon);
    return false;
  }
  function alertLevel(p={}){
    const risk=String(p.risk_colour_en||'').toLowerCase(),type=String(p.alert_type||'').toLowerCase();
    if(risk.includes('red'))return'warning';if(risk.includes('orange'))return'watch';if(risk.includes('yellow'))return'advisory';
    if(type.includes('warning'))return'warning';if(type.includes('watch'))return'watch';if(type.includes('advisory'))return'advisory';return'statement';
  }
  function alertRank(feature){return({warning:0,watch:1,advisory:2,statement:3})[alertLevel(feature.properties)]??4;}
  function alertTime(value){if(!value)return'';const d=new Date(value);return Number.isNaN(+d)?'':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

  async function loadOfficialAlerts(){
    const loc=locationState();const isCanada=String(loc.countryCode||'').toUpperCase()==='CA'||/canada/i.test(loc.country||'')||provinceCode(loc.admin1);
    if(!isCanada){alertCache=[];alertsFetchedAt=new Date();return alertCache;}
    const province=loc.provinceCode||provinceCode(loc.admin1);if(!province){alertCache=[];alertsFetchedAt=new Date();return alertCache;}
    const params=new URLSearchParams({f:'json',limit:'100',filter:`properties.province=${province}`});
    const response=await fetch(`${ALERTS_API}?${params}`,{cache:'no-store'});if(!response.ok)throw new Error(`Official alerts returned ${response.status}`);
    const data=await response.json(),point=[Number(loc.longitude),Number(loc.latitude)],needle=String(loc.name||'').toLowerCase();
    const spatial=(data.features||[]).filter(feature=>pointInGeometry(feature.geometry,point));
    const local=spatial.length?spatial:(data.features||[]).filter(feature=>needle.length>2&&String(feature.properties?.feature_name_en||'').toLowerCase().includes(needle));
    alertCache=local.sort((a,b)=>alertRank(a)-alertRank(b)||new Date(b.properties?.publication_datetime||0)-new Date(a.properties?.publication_datetime||0));alertsFetchedAt=new Date();return alertCache;
  }

  function renderAlertHub(){
    const home=$('#homeContent');if(!home)return;
    let hub=$('#v12AlertHub');if(!hub){hub=document.createElement('div');hub.id='v12AlertHub';hub.className='v12-alert-hub';const anchor=home.querySelector('.active-alerts')||home.querySelector('.hero');if(anchor)anchor.insertAdjacentElement('afterend',hub);else home.prepend(hub);}
    const count=alertCache.length,signature=`${locSig()}:${count}:${alertsFetchedAt?alertsFetchedAt.getTime():0}`;
    if(hub.dataset.v12Signature===signature)return;
    hub.dataset.v12Signature=signature;
    hub.classList.toggle('has-alerts',count>0);hub.innerHTML=`<button type="button" id="v12AlertHubButton"><span class="v12-alert-icon"><i data-lucide="${count?'triangle-alert':'shield-check'}"></i></span><span class="v12-alert-copy"><strong>${count?`${count} official weather alert${count===1?'':'s'}`:'Official weather alerts'}</strong><small>${count?'Warnings, watches, advisories or statements affect this location.':'No active ECCC warning, watch, advisory or statement for this location.'}</small></span><span class="v12-alert-count">${count}</span><i data-lucide="chevron-right"></i></button>`;
    $('#v12AlertHubButton')?.addEventListener('click',showAlerts);refreshIcons();
  }

  function renderAlertsSheet(){
    ensureSheets();const loc=locationState();$('#v12AlertsSubtitle').textContent=`${loc.name} · ${alertsFetchedAt?`checked ${alertsFetchedAt.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`:'checking now'}`;
    const body=$('#v12AlertsBody');
    if(!alertCache.length){body.innerHTML=`<div class="v12-empty"><i data-lucide="shield-check"></i><strong>No active official alerts</strong><div>No Environment and Climate Change Canada warning, watch, advisory or statement currently intersects this selected location.</div></div><div class="v12-source">Source: Environment and Climate Change Canada / Meteorological Service of Canada GeoMet weather-alerts collection.</div>`;refreshIcons();return;}
    body.innerHTML=`<div class="v12-alert-list">${alertCache.map(feature=>{const p=feature.properties||{},title=p.alert_name_en||p.alert_short_name_en||'Weather alert',area=p.feature_name_en||loc.name,level=alertLevel(p),ends=p.expiration_datetime||p.event_end_datetime;return `<article class="v12-alert-item ${level}"><span class="v12-alert-type">${escapeHtml(p.alert_type||level)}${p.risk_colour_en?` · ${escapeHtml(p.risk_colour_en)}`:''}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(area)}${ends?` · until ${escapeHtml(alertTime(ends))}`:''}</p>${p.alert_text_en?`<details><summary>Read official alert</summary><div class="v12-alert-text">${escapeHtml(p.alert_text_en).replace(/\r?\n/g,'<br>')}</div></details>`:''}</article>`;}).join('')}</div><div class="v12-source">Official ECCC alerts can include warnings, watches, advisories and statements. StormLens displays the government text and geographic alert area rather than generating its own warning.</div>`;refreshIcons();
  }
  async function showAlerts(){ensureSheets();openSheet('v12Alerts');const body=$('#v12AlertsBody');body.innerHTML='<div class="v12-empty"><i data-lucide="loader-circle"></i><div>Checking official alerts…</div></div>';refreshIcons();try{await loadOfficialAlerts();renderAlertHub();renderAlertsSheet();}catch(error){body.innerHTML=`<div class="v12-empty"><i data-lucide="triangle-alert"></i><strong>Official alerts unavailable</strong><div>${escapeHtml(error.message||'Could not contact ECCC.')}</div></div>`;refreshIcons();}}

  function decorateDailyRows(){
    document.querySelectorAll('.daily-list').forEach(list=>{[...list.querySelectorAll('.day-row')].forEach((row,index)=>{if(row.dataset.v12Day)return;row.dataset.v12Day=String(index);row.classList.add('v12-day-row');row.setAttribute('role','button');row.setAttribute('tabindex','0');row.setAttribute('aria-label',`Open details for forecast day ${index+1}`);row.insertAdjacentHTML('beforeend','<i class="v12-day-chevron" data-lucide="chevron-right"></i>');});});refreshIcons();
  }
  function bindDayRows(){
    document.addEventListener('click',event=>{const row=event.target.closest?.('.day-row[data-v12-day]');if(row)showDay(Number(row.dataset.v12Day));});
    document.addEventListener('keydown',event=>{const row=event.target.closest?.('.day-row[data-v12-day]');if(row&&(event.key==='Enter'||event.key===' ')){event.preventDefault();showDay(Number(row.dataset.v12Day));}});
  }

  async function refreshAlerts(){try{await loadOfficialAlerts();renderAlertHub();}catch(_){renderAlertHub();}}
  function observeApp(){
    const observer=new MutationObserver(()=>{decorateDailyRows();renderAlertHub();const sig=locSig();if(sig!==locationSignature){locationSignature=sig;forecastCache=null;forecastSignature='';clearTimeout(alertTimer);alertTimer=setTimeout(refreshAlerts,350);}});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function init(){ensureSheets();bindDayRows();decorateDailyRows();locationSignature=locSig();renderAlertHub();refreshAlerts();observeApp();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
