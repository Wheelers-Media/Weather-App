# StormLens premium weather data plan

StormLens uses open Canadian government data first and keeps commercial providers behind server-side Vercel environment variables. No private API key should ever be exposed in browser JavaScript.

## Working without private keys

### Environment and Climate Change Canada GeoMet
Used for the Canadian premium map engine:

- 1 km observed radar
- radar extrapolation nowcast
- observed precipitation type
- HRDPS forecast precipitation
- precipitation probability
- rain and snow accumulation
- freezing rain
- GOES-East / GOES-West satellite imagery
- temperature
- dew point
- humidity
- sea-level pressure
- cloud cover
- wind speed and gusts
- lightning density
- thunderstorm probability
- AQHI
- FireWork wildfire smoke PM2.5
- official Canadian alert map layers

GeoMet WMS: https://geo.weather.gc.ca/geomet
MSC Open Data docs: https://eccc-msc.github.io/open-data/

### Open-Meteo
Currently used for the main point forecast and model comparison during development.

For a commercial production release use an appropriate commercial Open-Meteo plan/customer endpoint or replace it through the provider abstraction.

Docs: https://open-meteo.com/en/docs

## Commercial providers to enable the remaining premium features

### Xweather / Vaisala
Environment variables:

- `XWEATHER_CLIENT_ID`
- `XWEATHER_CLIENT_SECRET`

Planned / prepared features:

- exact observed lightning strike locations
- strike type, polarity and amperage
- nearest-lightning distance and counts
- lightning threat nowcast up to 60 minutes
- storm movement information where provider coverage supports it
- hail / rotation / storm-cell intelligence where provider coverage supports it
- future MapsGL option for animated weather particles and high-performance map rendering

Server routes already prepared:

- `/api/xweather-lightning`
- `/api/xweather-lightning-threats`

Docs: https://www.xweather.com/docs/weather-api/endpoints/lightning
Docs: https://www.xweather.com/docs/weather-api/endpoints/lightning-threats

Important: Xweather NEXRAD storm-cell tracking is primarily a US product. Do not display US-only storm-cell attributes as if they were available for Calgary.

### AccuWeather MinuteCast
Environment variable:

- `ACCUWEATHER_API_KEY`

Feature:

- true minute-by-minute precipitation guidance for the next 120 minutes
- precipitation start/stop timing
- precipitation type and dBZ/color metadata when included by the subscribed response

Server route already prepared:

- `/api/minutecast`

Docs: https://developer.accuweather.com/minutecast

### Tomorrow.io
Environment variable:

- `TOMORROW_API_KEY`

Planned features:

- global forecast map tiles
- next-14-day time-aware map fields where available
- thunderstorm probability
- forecast lightning flash-rate density
- hail probability / hail size on entitled plans
- precipitation, temperature, cloud, wind, pressure and environmental layers

Server tile route already prepared:

- `/api/tomorrow-tile`

Docs: https://docs.tomorrow.io/reference/get-map-tile

### Google Pollen API
Environment variable:

- `GOOGLE_POLLEN_API_KEY`

Planned features:

- pollen forecast
- tree / grass / weed pollen heatmaps

Docs: https://developers.google.com/maps/documentation/pollen

### NASA FIRMS
Environment variable:

- `NASA_FIRMS_MAP_KEY`

Planned features:

- active satellite-detected fire hotspots
- hotspot age / confidence metadata where provided

Docs: https://firms.modaps.eosdis.nasa.gov/api/

## Provider-selection rules

1. Never label model precipitation as observed radar.
2. Never invent lightning strike counts from lightning-density grids.
3. Never show hail, rotation, storm-cell motion or arrival time unless a real source supports the field in that geography.
4. Use ECCC official alerts first in Canada.
5. If an overlay fails, show it as unavailable instead of silently leaving a blank map.
6. Every map overlay needs a source, time stamp, legend, opacity control and health state.
7. Compatible overlays must be stackable rather than mutually exclusive.
8. Keep all paid-provider credentials server-side.

## Recommended production stack for Calgary / Canada

- Base forecast: Open-Meteo commercial or another licensed forecast provider
- Official Canada radar / HRDPS / satellite / AQHI / smoke / alerts: ECCC GeoMet
- Exact lightning and short lightning-threat nowcasting: Xweather / Vaisala
- Minute precipitation timing: AccuWeather MinuteCast
- Optional global premium raster fields: Tomorrow.io
- Pollen: Google Pollen API
- Fire hotspots: NASA FIRMS

This stack intentionally uses several providers. No single provider is strongest at every weather product, and StormLens should expose the source instead of pretending every layer comes from one model.
