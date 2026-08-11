# StormLens Weather

Mobile-first radar and thunderstorm weather app prototype.

## Real data sources
- Open-Meteo: current conditions, hourly and 16-day forecast, model comparison.
- Environment and Climate Change Canada GeoMet WMS: observed radar, radar extrapolation nowcast, precipitation type, lightning density, thunderstorm probability, official alert map layer.

## Run locally
Serve the folder with any static web server. Example:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Deploy
This folder is deployable as a static site on Vercel, Netlify, Cloudflare Pages, or similar.

## Important
Open-Meteo's free hosted API is for non-commercial use. Before commercial release, use an appropriate commercial Open-Meteo plan, self-host, or replace the forecast provider through the app's provider layer.
