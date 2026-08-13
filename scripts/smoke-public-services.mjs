const CALGARY = { lat:51.0447, lon:-114.0719 };

async function request(name, url, validate) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'StormLens-Smoke/1.0'}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(validate && !validate(data)) throw new Error('response shape invalid');
    console.log(`OK   ${name}`);
    return true;
  } catch(error) {
    console.error(`FAIL ${name}: ${error.name==='AbortError'?'timeout':error.message}`);
    return false;
  } finally { clearTimeout(timer); }
}

const forecastParams=new URLSearchParams({
  latitude:String(CALGARY.lat), longitude:String(CALGARY.lon), timezone:'auto', forecast_days:'16',
  current:'temperature_2m,precipitation,weather_code,wind_speed_10m',
  hourly:'temperature_2m,precipitation_probability,precipitation,cape',
  daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum'
});
const airParams=new URLSearchParams({
  latitude:String(CALGARY.lat), longitude:String(CALGARY.lon), timezone:'auto', current:'us_aqi,pm2_5,pm10,ozone'
});
const geoParams=new URLSearchParams({name:'Calgary',count:'3',language:'en',format:'json'});

const checks=await Promise.all([
  request('Open-Meteo forecast',`https://api.open-meteo.com/v1/forecast?${forecastParams}`,d=>Number.isFinite(d?.current?.temperature_2m)&&Array.isArray(d?.hourly?.time)&&Array.isArray(d?.daily?.time)),
  request('Open-Meteo air quality',`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`,d=>d?.current && 'us_aqi' in d.current),
  request('Open-Meteo geocoding fallback',`https://geocoding-api.open-meteo.com/v1/search?${geoParams}`,d=>Array.isArray(d?.results)&&d.results.length>0),
  request('ECCC alerts API','https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=1&filter=properties.province=AB',d=>Array.isArray(d?.features))
]);

if(checks.some(ok=>!ok)) process.exit(1);
console.log('\nAll public StormLens service smoke checks passed.');
