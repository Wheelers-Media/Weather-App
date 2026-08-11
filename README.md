# StormLens Weather v2

Mobile-first radar and thunderstorm weather app with Calgary as the fallback base location and device geolocation support.

## Live data wired in
- Open-Meteo: current conditions, hourly forecast, 16-day forecast and selectable forecast models.
- Open-Meteo Air Quality API: AQI, PM2.5, PM10 and ozone.
- ECCC GeoMet WMS: 1 km observed radar, radar nowcast, precipitation type, 48-hour HRDPS precipitation forecast, precipitation probability, temperature, wind gusts, lightning density and thunderstorm probability.
- ECCC GeoMet OGC API: official Canadian alerts filtered to the selected location.
- ECCC `Current-Alerts` WMS: official alert polygons on the map.
- BigDataCloud client-side reverse geocoder: labels the phone's own consented GPS position after Android/Chrome grants location permission.

## Android / PWA
The app includes a web manifest, 192 px and 512 px icons and a service worker. When hosted over HTTPS, Chrome can install it to the Android home screen as a standalone PWA.

## Location behavior
- First launch asks whether to use the phone's precise location.
- Calgary, Alberta is the fallback/default location.
- Location can be changed later from Search or Settings.

## Deploy
The folder is deployable as a static site on Vercel. Upload all files at the repository root and import the repository into Vercel.

## Commercial release note
The current Open-Meteo public hosted API is suitable for development/non-commercial use under its published terms. Before a paid or commercial public release, move forecast and air-quality traffic to an appropriate commercial Open-Meteo endpoint/plan, self-host, or swap providers through the app's provider architecture.
