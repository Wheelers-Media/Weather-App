# StormLens Competitive Research: Premium Weather App Features & Radar API Alternatives

**Prepared for:** StormLens PWA (vanilla JS, Open-Meteo + MapTiler Weather SDK + ECCC GeoMet + optional Tomorrow.io), Calgary/Canada-focused
**Date:** August 16, 2026

Note on existing StormLens scope: the app's own documentation (`README.md`, `PREMIUM_APIS.md`) shows StormLens already integrates more than a baseline feature set — ECCC GeoMet radar/nowcast/precip-type/HRDPS/probability/accumulation/lightning-density/thunderstorm-probability/AQHI/wildfire-smoke layers, Open-Meteo current/hourly/16-day/air quality, official ECCC alerts, and has server routes already prepared (but likely not yet enabled) for Xweather lightning, AccuWeather MinuteCast, Tomorrow.io tiles, Google Pollen, and NASA FIRMS. This research treats the task's stated baseline (current conditions, 16-day/hourly forecast, day-detail sheet, alerts, air quality, animated radar, theme) as the comparison point per the brief, while flagging where StormLens's prepared-but-unwired integrations already address a gap.

---

## Part 1 — Competitive Feature Audit

### 1. Apple Weather (iOS)

- **Next-Hour Precipitation**: minute-level precipitation forecast for the next 60 minutes, shown as a chart, a high-resolution map overlay, and a push notification when rain/snow is about to start or stop. Sourced from national weather services and currently available only in Australia, Ireland, Japan, the UK, and the US — **not Canada** ([Apple Support: Feature availability and data sources](https://support.apple.com/en-us/105038); [Apple Support: Dark Sky migration guide](https://support.apple.com/en-us/102594)).
- **Severe Weather notifications**: government-issued severe alerts, toggled independently per saved location, available in Canada among other countries ([iPhone Weather app 14 new features](https://ios.gadgethacks.com/how-to/your-iphones-weather-app-just-got-14-major-new-features-0385062/)).
- **iOS 27 "Highlights" and condition-specific views**: a home-page callout summarizing "noteworthy" upcoming weather, plus dedicated Precipitation and Wind forecast views that replace the default hourly/daily cards with single-condition focus ([9to5Mac](https://9to5mac.com/2026/06/17/apple-weather-gets-two-brand-new-features-in-ios-27/); [MacRumors iOS 27 Weather guide](https://www.macrumors.com/guide/ios-27-weather/)).
- **Widgets and interactive map**: eight distinct widget types (Air Quality, Conditions, Moon, Precipitation, Sunrise/Sunset, Temperature, UV Index, Wind), full-screen animated precipitation map with 1-hour/12-hour toggle and layer switching (temperature, air quality, wind) ([idropnews widget guide](https://www.idropnews.com/how-to/iphone-weather-app-settings-to-turn-on/265743/)).
- **Predicted-destination alerts (iOS 26)**: uses on-device "Significant Locations & Routes" to proactively surface severe weather for places a user is likely to travel to soon ([MacRumors](https://www.macrumors.com/2025/06/10/ios-26-severe-weather-predicted-destinations/)).

### 2. Google Weather (Pixel / Android)

- **Nowcast map**: Google's MetNet-3 neural-network model produces high-resolution precipitation nowcasts up to 12 hours out for the US and Europe; the Pixel Weather app surfaces a 6-hour precipitation map only when relevant (rain/hail/snow imminent) rather than always-on ([Android Police](https://www.androidpolice.com/google-new-weather-experience-nowcast/); [ASOasis: Google Weather March 2026 refresh](https://asoasis.tech/news/2026-03-13-1154-google-weather/)).
- **Precipitation notifications**: customizable per-location alerts for imminent rain/snow, current location or saved locations ([Lifehacker](https://lifehacker.com/tech/get-the-most-out-of-googles-pixel-weather-app); [Google Support](https://support.google.com/pixelphone/answer/15266029?hl=en)).
- **Coverage caveat**: Google's own nowcast/precipitation-map coverage explicitly excludes some regions and is strongest in the US/UK/Europe; Canada-specific nowcast quality is not documented as a flagship feature the way it is for the US ([PhoneArena](https://www.phonearena.com/news/google-releases-pixel-weather-app-for-pixels-6-and-newer-including-the-tablet_id164299)).
- **Simple, card-based UI**: hourly carousel + 10-day forecast cards, minimal chrome — a UX pattern (glanceable cards over dense tables) worth emulating for StormLens's day-detail sheet.

### 3. The Weather Channel app / weather.com

- **Free tier**: 15-minute rain-intensity forecast up to 7 hours out, radar homescreen widget, hour-by-hour 10-day forecast, health-impact trackers (allergies, cold/flu, migraine) ([App Store listing](https://apps.apple.com/gb/app/weather-the-weather-channel/id295646461); [AppsThunder feature roundup](https://appsthunder.com/weather-apps-forecasts-2025/)).
- **Premium gate (what to aspire to)**: ad-free experience, "Advanced 72-Hour Future Radar," extended hourly forecast (192 hours / 8 days at 1-hour resolution instead of the free tier's shorter horizon), and a Premium Perks bundle (third-party discounts) ([App Store](https://apps.apple.com/gb/app/weather-the-weather-channel/id295646461); [AppAdvice Apple TV listing](https://appadvice.com/tv/app/weather-the-weather-channel/295646461); [Weather Company blog](https://www.weathercompany.com/blog/your-premium-subscription-just-got-a-major-upgrade/)).
- **Interactive radar with ~15 stackable layers** and a dedicated hurricane tracker — evidence that "many toggleable layers in one map, not separate screens" is an expected premium pattern ([AppsThunder](https://appsthunder.com/weather-apps-forecasts-2025/)).

### 4. Windy.com (radar/map UX benchmark)

- **Timeline scrubbing + play/pause with speed control**: a bottom timeline bar lets users drag through past/future frames; separate "tortoise/hare" animation-speed presets exist specifically for radar layers ([ScreensDesign UI breakdown](https://screensdesign.com/showcase/windycom-weather-radar); [Windy Community: animation speed controls](https://community.windy.com/topic/40834/animation-speed-controls)).
- **Radar+ (satellite + radar composite layer)**: blends satellite imagery and radar into one view, with a 365-day history archive behind Windy Premium ([Windy.com article: Radar+ launch](https://www.windy.com/articles/36164)).
- **Radar Nowcasting**: 1-hour-ahead extrapolation computed via optical flow, shown directly on the radar timeline ([Windy Community v41 release notes](https://community.windy.com/topic/31309/windy-s-version-41-is-here-and-brings-new-features)).
- **Compare-forecasts mode**: side-by-side multi-model comparison (view multiple weather models' output for the same point at once) plus power-user tools like distance measurement and sounding charts ([ScreensDesign](https://screensdesign.com/showcase/windycom-weather-radar)).
- **Customizable threshold alerts**: users define specific wind/temperature/precipitation triggers for notifications, a more granular pattern than a simple "it's raining" push ([ScreensDesign](https://screensdesign.com/showcase/windycom-weather-radar)).
- **Windy Point Forecast / Map Forecast APIs are not viable free options for production**: the free "Testing" tier explicitly returns randomly shuffled/modified data and is restricted to development use only; the paid Professional tier costs €990/year and still excludes ECMWF unless an extra €1,000/year is paid ([Windy API Point Forecast pricing](https://api.windy.com/point-forecast/pricing); [Windy API Map Forecast pricing](https://api.windy.com/map-forecast/pricing)).

### 5. RainViewer (radar-specialist app/site)

- **Radar timeline player**: past 6 hours plus up to 2-hour forecast (30-90-120 min depending on tier) blended into one continuous animated loop, with a "LIVE" indicator and per-tap frame-age display ([RainViewer blog: new radar animation player](https://www.rainviewer.com/blog/all-new-radar-animation-player.html); [App Store listing](https://apps.apple.com/us/app/rainviewer-noaa-weather-radar/id980123924)).
- **Share/export radar animation**: users can export the visible radar loop as a GIF or MP4 (including forecast frames) and share directly to messaging apps/social media — a distinctive "shareability" feature no baseline weather app typically offers ([RainViewer blog: Share Rain Radar Animation](https://www.rainviewer.com/blog/share-rain-radar-animation.html)).
- **Live radar widget**: a home-screen widget showing the animated radar map itself (not just a text forecast), refreshed every 10 minutes ([RainViewer blog: widgets release](https://www.rainviewer.com/blog/rainviewer-released-weather-widgets-radar-map.html)).
- **Premium-gated extras** (aspirational, not to paywall): 48-hour radar history, multi-model 72-hour precipitation/temperature forecasts (ICON, ICON-EU, GFS, HRRR, ECMWF), individual radar-product layers (velocity, ZDR) for storm-chasing detail, 2-minute refresh instead of 5-minute ([App Store listing](https://apps.apple.com/us/app/rainviewer-noaa-weather-radar/id980123924); [RainViewer homepage](https://www.rainviewer.com/)).

### 6. MyRadar

- **Hyperlocal rain-arrival alerts**: a patent-pending model predicts, up to an hour in advance, the exact minute rain will arrive at the user's location, including intensity/duration — functionally similar to AccuWeather MinuteCast but framed as a proactive push notification rather than a chart the user must open ([MyRadar homepage](https://myradar.com/); [Google Play listing](https://play.google.com/store/apps/details?id=com.acmeaom.android.myradar&hl=en_US)).
- **Premium gate (aspirational)**: hurricane cone-of-probability tracking with National Hurricane Center synopsis text, and a "Pro Radar" pack exposing individual radar station selection, tilt angle, and base-reflectivity vs. velocity products — power-user radar detail beyond a single composite ([App Store listing](https://apps.apple.com/us/app/myradar-accurate-weather-radar/id322439990); [Reddit r/MyRadar premium breakdown](https://www.reddit.com/r/MyRadar/comments/170zldh/premium_vs_free/)).
- **RouteCast**: enter a start/end point and get a forecast for road conditions along the route — relevant for a Calgary-area highway-driving audience ([Reddit r/MyRadar](https://www.reddit.com/r/MyRadar/comments/170zldh/premium_vs_free/)).

### 7. CARROT Weather (personality/premium features)

- **Personality-driven AI**: five selectable personalities (Professional, Friendly, Snarky, Homicidal, Overkill) that flavor every forecast string, plus a full ChatGPT-based conversational mode with adjustable tone (suave, pirate, mobster, etc.) ([TechCrunch](https://techcrunch.com/2023/03/15/carrot-weather-app-new-chatbot-with-chatgpt-update/); [CARROT Weather Support](https://support.meetcarrot.com/weather/)).
- **Time Machine**: historical weather lookup for any date up to ~70 years in the past (and forecast up to 10 years out as a joke feature), delivered with in-character commentary — a strong "on this day" precedent StormLens could implement seriously using Open-Meteo's archive API ([Google Play listing](https://play.google.com/store/apps/details?id=com.grailr.carrotweather&hl=en_GB); [ScreensDesign UI breakdown](https://screensdesign.com/showcase/carrot-weather-alerts-radar)).
- **Gamification**: achievement system, "missions" (find secret locations via clues), and an interactive relationship with the AI (charge/praise/debug) that drives repeat engagement ([ScreensDesign](https://screensdesign.com/showcase/carrot-weather-alerts-radar)).
- **Deep customization behind paywall**: fully custom home-screen/widget layouts, per-complication data-point picking, half-hourly background refresh, and multiple data-source switching (Weather Underground, AccuWeather, Apple Weather, The Weather Channel) as premium tiers ([support.meetcarrot.com](https://support.meetcarrot.com/weather/); [TapSmart deep dive](https://www.tapsmart.com/features/deep-dive-carrot-weather/)).
- Notably, CARROT added **official government alerts for Canada** specifically as a Premium Ultra feature in 2023, underscoring that Canadian alert coverage is treated as a premium differentiator by US-centric apps — StormLens's ECCC-first approach is already ahead here ([9to5Mac](https://9to5mac.com/2023/03/15/carrot-weather-with-chatgpt-snark/)).

### 8. AccuWeather (MinuteCast)

- **MinuteCast**: patented minute-by-minute precipitation forecast for the next 60-120 minutes (up to 4 hours in the consumer app), pinpointed to exact GPS coordinates, including precipitation type/intensity and start/stop timing down to the minute, available in 210 countries and territories ([AccuWeather Enterprise API docs](https://apidev.accuweather.com/developers/forecasts/general); [Google Play listing](https://play.google.com/store/apps/details?id=com.accuweather.android&hl=en_US); [AccuWeather press release](https://www.accuweather.com/en/press/49568860)).
- **Higher-resolution intervals**: the underlying API can return 1-, 5-, or 15-minute interval buckets with a dBZ value and precipitation-type per minute, plus optional color metadata for rendering a mini radar-style bar ([AccuWeather Enterprise API docs](https://apidev.accuweather.com/developers/forecasts/general)).
- **RealFeel / RealFeel Shade Temperature**: a proprietary "feels like" metric factoring in more variables than standard heat index/wind chill — a differentiator StormLens could approximate using Open-Meteo's `apparent_temperature` field, though not identical.
- **Premium Plus gate (aspirational)**: longer-range forecasts, exclusive "AccuWeather Alerts" with more lead time than government alerts, ad-free experience, AQI lock-screen widget ([AccuWeather press release on 50+ new features](https://www.accuweather.com/en/press/accuweather-launches-improved-app-with-over-50-new-and-enhanced-features/1809373)).
- StormLens's `PREMIUM_APIS.md` already scaffolds an `/api/minutecast` route — this is the single highest-value "premium-feel" feature missing from the currently-enabled feature set, since none of Open-Meteo/MapTiler/ECCC natively provide true minute-by-minute precipitation timing.

### 9. Environment Canada's WeatherCAN app (Canadian user expectations)

- **Official baseline Canadian users expect**: current + hourly + 7-day forecast for 10,000+ Canadian locations, high-resolution zoomable radar animation, push notifications for **all** ECCC-issued alerts (not a subset), bilingual English/French toggle, and Indigenous-language place-name symbols for northern communities ([Canada.ca WeatherCAN page](https://www.canada.ca/en/mobile/weathercan.html); [Canada.ca WeatherCAN feature page](https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/weathercan.html)).
- **AQHI (Air Quality Health Index) prominence**: the October 2024 WeatherCAN redesign moved air quality to near the top of each location page specifically to surface wildfire-smoke risk faster — validates that AQHI should be a top-of-page element, not buried, for a Calgary-focused app in wildfire season ([Canada.ca: Changes coming to WeatherCAN](https://www.canada.ca/en/environment-climate-change/news/2024/10/changes-are-coming-to-weathercan-canadas-official-weather-application.html)).
- **Customizable temperature/humidex/windchill threshold notifications**: users set their own trigger thresholds rather than relying only on official alert tiers — a pattern also seen in Windy's custom alerts ([Canada.ca: WeatherCAN changes](https://www.canada.ca/en/environment-climate-change/news/2024/10/changes-are-coming-to-weathercan-canadas-official-weather-application.html)).
- **New (Nov 2025) colour-coded alert system**: ECCC replaced the old text-only watch/warning/advisory model with a yellow/orange/red risk-based colour system, plus polygon-based (not just zone-based) severe thunderstorm/tornado warnings launched August 2026 — StormLens's alert UI should render the new colour tiers and, where the ECCC feed provides polygons, draw the actual warned shape rather than a whole forecast region ([Canada.ca: new weather alert system](https://www.canada.ca/en/environment-climate-change/news/2025/11/government-of-canada-announces-new-weather-alert-system-to-help-protect-canadians-in-extreme-weather.html); [Canada.ca: tornado/thunderstorm warning improvements](https://www.canada.ca/en/environment-climate-change/news/2026/08/government-of-canada-launches-improvements-to-tornado-and-thunderstorm-warnings-to-help-keep-people-in-canada-safe.html)).
- **Government UX research findings** (Government of Canada design team): mobile-first design with less prose, fewer navigation layers, and "answers not information" improved task success dramatically (e.g., radar-based decision-making success rose from 0% to 31%, alert-detail findability from 6% to 63%) — directly actionable UX guidance for StormLens's alert and radar screens ([design.canada.ca Weather optimization research summary](https://design.canada.ca/research-summaries/weather-research-summary.html)).
- **Message centre**: a feed of contextual "weather facts and climate information" tied to current conditions (e.g., drought monitor content) — a lightweight content feature StormLens doesn't have an equivalent of ([Canada.ca WeatherCAN page](https://www.canada.ca/en/mobile/weathercan.html)).

---

## Open-Meteo capability check (what's actually available, since several "premium" features above map to it)

Verified directly against Open-Meteo's own docs:

- **UV index**: available via the Air Quality API (`uv_index`, `uv_index_clear_sky`), globally — usable for Calgary ([Open-Meteo Air Quality API docs](https://open-meteo.com/en/docs/air-quality-api)).
- **Air quality**: PM2.5, PM10, NO₂, O₃, SO₂, CO, dust, US AQI and European AQI, globally, via the Air Quality API ([Open-Meteo Features page](https://open-meteo.com/en/features)).
- **Pollen**: alder, birch, grass, mugwort, olive, and ragweed pollen are provided **only for Europe**, sourced from the CAMS European Air Quality forecast — **not available for Calgary/Canada**. Any pollen feature for StormLens's Canadian audience needs a different source (e.g., Google Pollen API, already scaffolded in `PREMIUM_APIS.md`) ([Open-Meteo Air Quality API docs](https://open-meteo.com/en/docs/air-quality-api)).
- **Historical / "on this day" data**: the Historical Weather API (`archive-api.open-meteo.com/v1/archive`) covers 1940–present globally at ~9-25km resolution (ERA5/ERA5-Land), free for non-commercial use — this is sufficient to build a real "on this day" / historical-comparison feature for Calgary ([Open-Meteo Historical Weather API docs](https://open-meteo.com/en/docs/historical-weather-api)).
- **AI-generated summaries**: Open-Meteo itself does not offer this; OpenWeatherMap's One Call API 3.0/4.0 does, at no extra cost over its metered price, via an "AI-powered Weather Overview" (human-readable natural-language summary) ([OpenWeather Medium post](https://openweathermap.medium.com/openweather-one-call-api-3-0-introducing-human-readable-weather-summaries-425d16942b5c)).
- **Free-tier commercial-use restriction**: Open-Meteo's free/keyless tier (600 calls/min, 5,000/hour, 10,000/day, ~300,000/month) is explicitly for **non-commercial use only**; a paid Standard plan (~$29/month) is required for any app carrying subscriptions or ads — StormLens's own `README.md` already flags this correctly ([Open-Meteo Terms](https://open-meteo.com/en/terms); [Open-Meteo Pricing](https://open-meteo.com/en/pricing)).
- **No minute-by-minute nowcasting**: confirmed — Open-Meteo's free tier updates hourly and has no true minute-level precipitation timing product, reinforcing that MinuteCast-style features require AccuWeather (or similar) ([dev.to Open-Meteo overview](https://dev.to/0012303/open-meteo-has-a-free-weather-api-no-key-no-signup-real-forecast-data-2nna)).

---

## Synthesis — Top 8-10 Premium Features StormLens Is Likely Missing

Ranked roughly by (a) how consistently it appears across the audited apps and (b) feasibility with free/low-cost APIs given StormLens's existing stack.

1. **True minute-by-minute precipitation nowcasting ("next hour, minute-by-minute")** — the single most universal "premium feel" signal (Apple Next-Hour Precipitation, MyRadar hyperlocal alerts, AccuWeather MinuteCast, Google/Pixel Nowcast). Not derivable from Open-Meteo or ECCC's 6-minute radar refresh alone as a per-minute chart; the closest realistic path is AccuWeather MinuteCast (already scaffolded as `/api/minutecast` in StormLens per `PREMIUM_APIS.md`) or building an approximation from ECCC's radar-extrapolation nowcast layer resampled into a minute-level chart. ([Apple Support](https://support.apple.com/en-us/105038); [AccuWeather docs](https://apidev.accuweather.com/developers/forecasts/general))

2. **Proactive "rain starting/stopping soon" push notifications** — nearly every top app (Apple, Google/Pixel, MyRadar, Windy custom alerts, WeatherCAN threshold alerts) treats push notification for imminent precipitation as core, not optional. StormLens currently has no notification system mentioned in its README. This is implementable as a PWA using the Notifications/Push API plus periodic background sync checking Open-Meteo's `precipitation_probability`/`precipitation` minutely_15 or hourly fields, or ECCC nowcast layers, against user location. ([Apple Support notifications guide](https://support.apple.com/guide/iphone/manage-weather-notifications-iph39ae9474a/ios); [MyRadar homepage](https://myradar.com/))

3. **Radar animation export/share as GIF/MP4** — a distinctive, low-cost-to-build feature (client-side canvas capture of the existing MapTiler/ECCC radar frames) that no competitor except RainViewer offers, and it directly leverages animation StormLens already has. High shareability value for severe-weather events in Alberta. ([RainViewer blog](https://www.rainviewer.com/blog/share-rain-radar-animation.html))

4. **Multi-model / "compare forecasts" view** — Windy's standout power-user feature; Open-Meteo natively supports switching between 30+ forecast models via the `models` parameter, which StormLens's README says it already surfaces for "model comparison during development" — this could be promoted to a user-facing feature rather than a dev tool. ([Open-Meteo homepage](https://open-meteo.com/); ScreensDesign Windy breakdown)

5. **Real "on this day" / historical weather comparison** — CARROT's Time Machine and general "historical weather" expectations are fully achievable using Open-Meteo's free Historical Weather API (1940–present, global), which StormLens is not currently using for user-facing historical lookups. ([Open-Meteo Historical Weather API docs](https://open-meteo.com/en/docs/historical-weather-api))

6. **AI-generated natural-language forecast summary** — a "Highlights"-style plain-English callout (à la Apple's iOS 27 Highlights, or OpenWeatherMap's free-with-subscription AI Weather Overview) that synthesizes the day's forecast, alerts, and AQHI into 1-2 sentences. Could be built cheaply using OpenWeatherMap One Call 3.0/4.0's AI summary endpoint (1,000 free calls/day) as a supplementary source, or a lightweight self-authored template/LLM call, layered on top of existing Open-Meteo data. ([OpenWeather Medium post](https://openweathermap.medium.com/openweather-one-call-api-3-0-introducing-human-readable-weather-summaries-425d16942b5c); [9to5Mac iOS 27](https://9to5mac.com/2026/06/17/apple-weather-gets-two-brand-new-features-in-ios-27/))

7. **Pollen tracking for Canada** — every "depth" comparison app (Weather Channel health trackers, AccuWeather) treats pollen/allergy data as expected premium depth, but Open-Meteo's pollen data is Europe-only and therefore useless for Calgary. StormLens's own `PREMIUM_APIS.md` already scaffolds a Google Pollen API integration (`GOOGLE_POLLEN_API_KEY` / `/api pollen` route) — wiring this up is the fastest way to close this specific gap. ([Open-Meteo Air Quality API docs](https://open-meteo.com/en/docs/air-quality-api); Google Pollen API per StormLens's own PREMIUM_APIS.md)

8. **Home-screen / lock-screen widgets with live radar or condition data** — near-universal across Apple Weather, RainViewer, MyRadar, CARROT, AccuWeather. As a PWA this is constrained by platform limits (no native iOS/Android widget API without wrapping in a native shell), but Android's "Add to Home Screen" PWA + a periodic Web Push badge, or a future TWA/Capacitor wrapper, could approximate this; at minimum, a compact "install as PWA + rich favicon/badge" pattern should be considered a documented limitation rather than silently absent. ([RainViewer widget blog](https://www.rainviewer.com/blog/rainviewer-released-weather-widgets-radar-map.html); [Apple widgets guide](https://support.apple.com/guide/iphone/use-weather-widgets-iph8bf15cb61/ios))

9. **Individual radar-product depth for storm-chasers (velocity, per-station tilt, ZDR)** — MyRadar Pro Radar and RainViewer Pro Radar both gate this as premium; ECCC GeoMet actually already has some of the deepest freely-available official radar products in the world (freezing rain, precip type, HRDPS, lightning density) that StormLens is already using — the gap is more about **UX exposure** (layer blending, opacity per layer, a proper legend/timestamp/health-state per layer as StormLens's own `PREMIUM_APIS.md` provider rules already mandate) than about missing data. Treat this as a UX polish item rather than a new API integration. ([MyRadar Reddit thread](https://www.reddit.com/r/MyRadar/comments/170zldh/premium_vs_free/); [RainViewer App Store listing](https://apps.apple.com/us/app/rainviewer-noaa-weather-radar/id980123924))

10. **Route-based / travel-destination forecasting** — MyRadar's RouteCast and Apple's iOS 26 predicted-destination alerts both reflect a "forecast where I'm going, not just where I am" pattern, relevant for a Calgary-based app given how much of Alberta's population drives highway distances (e.g., Calgary–Banff, Calgary–Edmonton). Buildable using Open-Meteo point-forecast calls along a route polyline with no new provider needed. ([Reddit r/MyRadar](https://www.reddit.com/r/MyRadar/comments/170zldh/premium_vs_free/); [MacRumors iOS 26 predicted destinations](https://www.macrumors.com/2025/06/10/ios-26-severe-weather-predicted-destinations/))

**Also worth flagging (lower priority / already partly covered):** severe-weather alert **polygon rendering** should be updated to match ECCC's new colour-coded (yellow/orange/red) system and its new targeted warning polygons rather than older zone-based rendering ([Canada.ca alert system announcement](https://www.canada.ca/en/environment-climate-change/news/2025/11/government-of-canada-announces-new-weather-alert-system-to-help-protect-canadians-in-extreme-weather.html)); a lightweight "message centre" style content feed (drought monitor, wildfire smoke advisories, seasonal facts) mirrors WeatherCAN and adds Canadian authenticity at near-zero API cost ([Canada.ca WeatherCAN](https://www.canada.ca/en/mobile/weathercan.html)).

---

## Part 2 — Free / Low-Cost Weather Radar API Comparison

| Provider | Free tier limits | Canada coverage | Integration | Cost beyond free tier |
|---|---|---|---|---|
| **RainViewer Weather Maps API** | No API key/registration required. Public `weather-maps.json` endpoint returns tile URLs for **past 2 hours** of radar (10-min steps) plus nowcast frames; explicitly licensed "free for personal, educational, and small-scale community use." A separate commercial **Tiles/Forecast API** (used by their own products) has a published paid structure: Tiles $0.20/1,000 calls with 30,000 free/month; Forecast $0.10/1,000 calls with 5,000 free/month; a broader "Free Tier: 1,000 calls/day" plan also appears in their 2025 overview. | Yes — RainViewer aggregates radar from 90+ countries including Canada, sourced from Environment Canada among named national agencies; Calgary/Alberta should be covered subject to Environment Canada's own radar network. | Very easy: raw XYZ tile URLs, drop into any Leaflet/MapLibre raster source; official example repo provided in plain HTML+JS. No SDK lock-in. | If exceeding free/keyless tier via the commercial Tiles/Forecast API: Startup $40/mo (100k calls), Developer $180/mo (1M calls), Professional $600/mo (5M calls). | 
Sources: [RainViewer API docs](https://www.rainviewer.com/api.html), [RainViewer Weather Maps API reference](https://www.rainviewer.com/api/weather-maps-api.html), [RainViewer 2025 API overview/pricing](https://www.rainviewer.com/blog/weather-radar-apis-2025-overview.html), [RainViewer API transition FAQ](https://www.rainviewer.com/api/transition-faq.html), [RainViewer data source attribution page](https://www.rainviewer.com/sources.html), [RainViewer GitHub example](https://github.com/rainviewer/rainviewer-api-example) |
| **Windy.com Point Forecast / Map Forecast API** | "Testing" tier is **free but explicitly not for production** — it returns randomly shuffled/modified data, capped at 500 requests/day. There is no usable free production tier. | N/A for free tier (data is intentionally altered); Professional tier models (GFS, ICON, NAM, AROME, HRRR) have global coverage including Canada, but ECMWF (best global model) costs an extra ~€1,000/year. | Point Forecast: simple POST JSON API. Map Forecast: tile-based, needs Windy's map wrapper for full functionality — moderate integration effort, heavier than RainViewer's raw tiles. | Professional plan: **€990/year** for either Point Forecast or Map Forecast API (each sold separately), 10,000 sessions/day (negotiable), unlimited layers/models except ECMWF. |
Sources: [Windy Point Forecast pricing](https://api.windy.com/point-forecast/pricing), [Windy Map Forecast pricing](https://api.windy.com/map-forecast/pricing), [Windy API Terms of Use](https://account.windy.com/agreements/windy-api-map-and-point-forecast-terms-of-use), [Windy Community on Professional-only production use](https://community.windy.com/topic/18397/want-to-apply-for-api-subscription) |
| **Tomorrow.io API** | Free API Plan: **500 requests/day, 25/hour, 3/second**; up to 5-day forecast horizon; 24 hours of historical data; 1 monitored location; 1 weather alert; core parameters only (temp, wind, precip, humidity) plus the Thunderstorm Probability layer, which is explicitly listed as a **free/core** layer even though most premium layers (pollen, air quality, lightning flash-rate density) require a paid/Enterprise plan. Map tile requests count 1-per-tile against the same quota. | Yes, global model-based coverage; Tomorrow.io's Active Severe Weather Events layer explicitly covers US, Canada, and Europe. | Easy: documented raster XYZ tile endpoint (`maps2.tomorrow.io/weather/{key}/...`) works directly with Leaflet/MapLibre; StormLens already has a prepared `/api/tomorrow-tile` server route. | Paid tiers are usage/volume-based via "contact sales" (no fully public self-serve price list beyond Free/Enterprise framing); premium layers (pollen, lightning flash-rate density, air quality) require paid access. |
Sources: [Tomorrow.io Free API Plan Rate Limits](https://support.tomorrow.io/hc/en-us/articles/20273728362644-Free-API-Plan-Rate-Limits), [Tomorrow.io Pricing Overview](https://support.tomorrow.io/hc/en-us/articles/23554984091156-Tomorrow-io-Pricing-Overview), [Tomorrow.io Weather Data Layers timestep table](https://docs.tomorrow.io/reference/weather-data-layers), [Tomorrow.io Weather Maps API product page](https://www.tomorrow.io/weather-api/weather-maps-api/), [Tomorrow.io Platform Map Layers doc](https://support.tomorrow.io/hc/en-us/articles/38448979426452-Tomorrow-io-Platform-Map-Layers-Visualization-of-Weather-Parameters), [Thunderstorm Probability core-feature doc](https://support.tomorrow.io/hc/en-us/articles/38449058009748-Thunderstorm-Probability-Core-Feature-Included) |
| **OpenWeatherMap** (Weather Maps 1.0 / One Call 3.0 & 4.0) | Classic free bundle (current weather, 5-day/3-hr forecast, geocoding, **Weather Maps 1.0** tile layers, air pollution): **60 calls/min, 1,000,000 calls/month**, no credit card. Separately, One Call 3.0/4.0 (adds AI weather summary) is pay-per-call but includes **1,000 free calls/day**; requires a credit card on file even to stay within the free allotment. | Global coverage; standard model-based radar/precipitation tiles, not a dedicated live-radar network — weaker on true observed-radar fidelity for Canada than RainViewer/ECCC. | Easy: standard XYZ raster tiles for Weather Maps 1.0; well-documented REST endpoints. | Startup 600 calls/min (10M/month), Developer 3,000 calls/min (100M/month), Professional 30,000 calls/min (1B/month), Expert 100,000 calls/min (3B/month); One Call overage billed per 100 calls beyond the free daily allotment. |
Sources: [OpenWeather Pricing page](https://openweathermap.org/price), [OpenWeather One Call 3.0 doc](https://openweathermap.org/api/one-call-3), [OpenWeather One Call 4.0 doc](https://openweathermap.org/api/one-call-4), [OpenWeather full pricing/limits page](https://openweathermap.org/full-price), [OpenWeather AI Weather Overview announcement](https://openweathermap.medium.com/openweather-one-call-api-3-0-introducing-human-readable-weather-summaries-425d16942b5c) |
| **Xweather (formerly AerisWeather, now part of Vaisala)** | **15,000 free API accesses/month**, no credit card required, no expiry, full access to every endpoint including Raster Maps (100+ tile layers). In the US and Canada specifically, users can add a payment method to pay-as-you-go beyond 15,000; outside US/Canada requires a sales conversation. | Explicitly calls out **US and Canada** as the self-serve pay-as-you-go region — a positive signal for a Calgary-focused app; StormLens's own `PREMIUM_APIS.md` already has this provider scaffolded for lightning strikes/threats (noting NEXRAD storm-cell tracking is US-only). | Raster Maps tile endpoint compatible with Mapbox/Google Maps/Leaflet; documented REST API and an Android/iOS SDK also exist. | Paid Raster Maps/API bundle at **€300/month for 1,000,000 accesses**, scaling to €600-950/month for 3-10M; per-unit raster map pricing shown as $0.0006/map unit on their pricing calculator. |
Sources: [Xweather free tier product page](https://www.xweather.com/products/weather-api), [Xweather pay-as-you-go pricing calculator](https://www.xweather.com/pricing/weather-api-pay-as-you-go), [RFP.wiki Xweather pricing summary](https://www.rfp.wiki/specialty-industries/energy-utilities-software/weather-data-solutions-for-energy-and-utilities/meteomatics/xweather), StormLens's own `PREMIUM_APIS.md` |
| **WeatherAPI.com** | Free tier reported inconsistently across sources as either 1,000,000 calls/month (most current, June 2026 apio.sh review) or older figures of 100,000/month; includes 3-day forecast, limited historical (1-7 days depending on source), alerts, and astronomy on the free plan; attribution required. | Global coverage, no Canada-specific radar/nowcast product — primarily a point-forecast/current-conditions API, not a dedicated radar-tile provider. | Simple REST JSON API; **no dedicated radar map tile product** comparable to RainViewer/Tomorrow.io — would need to be paired with a separate tile provider for a map. | Paid plans start at $9-39/month range with higher call volumes and longer forecast horizons. |
Sources: [apio.sh WeatherAPI pricing review](https://apio.sh/apis/weatherapi), [Hypereal AI top weather APIs comparison](https://hypereal.tech/a/top-weather-api), [DataGlobeHub WeatherAPI profile](https://dataglobehub.com/api-finder/weatherapi/) |
| **Meteomatics** | Free Basic account exists for **non-commercial/private use only**; a separate 14-day free trial exists for the commercial Weather API. No public self-serve commercial free tier. | Global high-resolution modeled data (1km EURO1k/US1k-class models cited); not a dedicated observed-radar product and not documented as Canada-specific. | Enterprise-style REST API with 1,800+ parameters; heavier integration than tile-based competitors, and pricing requires a sales conversation. | Custom/quote-based; no public list price. |
Sources: [Meteomatics free Basic account signup](https://www.meteomatics.com/en/sign-up-weather-api-free-basic-account/), [Meteomatics pricing page](https://www.meteomatics.com/en/pricing/), [RFP.wiki Meteomatics vs Xweather comparison](https://www.rfp.wiki/specialty-industries/energy-utilities-software/weather-data-solutions-for-energy-and-utilities/meteomatics/xweather) |
| **MapTiler Weather SDK** (StormLens's current radar/animation engine) | Free MapTiler Cloud plan includes the Weather SDK/module at no extra cost — "included in your FREE MapTiler plan," usage counted as normal MapTiler Cloud API sessions (a separate free-plan listing cites roughly 5,000 sessions/month, 100,000 API requests/month on the base free tier). Weather layers animate at 60fps client-side using MapTiler's own hosted weather-model tiles. | Global model-based radar/precipitation animation (not the same as observed ECCC radar) — StormLens correctly complements it with ECCC GeoMet for authoritative Canadian observed radar. | Very easy — it's a first-party SDK module (`docs.maptiler.com/sdk-js/modules/weather/`) already integrated into StormLens, with built-in animation helpers (e.g., `animateByFactor`). | Paid MapTiler Cloud tiers (Flex $25/month, Unlimited $295/month) scale session/request limits if StormLens's traffic grows beyond the free plan. |
Sources: [MapTiler Weather API/SDK product page](https://www.maptiler.com/weather/), [MapTiler Weather JS module docs](https://docs.maptiler.com/sdk-js/modules/weather/), [MapTiler Weather radar example](https://docs.maptiler.com/sdk-js/examples/weather-radar/), [MapTiler free-SDK announcement](https://www.maptiler.com/news/2023/07/free-weather-sdk-and-api-for-web-maps-apps/), [Launch Europe MapTiler pricing summary](https://launcheurope.eu/en/business/products/digital/maptiler/) |
| **ECCC GeoMet WMS** (StormLens's current official-Canada layer) | Fully free, no API key, no rate-limit tier structure published (open government data); radar composite/extrapolation layers update every 6 minutes with **3 hours of data retained** on GeoMet. | Best-in-class for Canada specifically — this is the authoritative national radar source WeatherCAN itself uses. | WMS/OGC-API standard; moderate integration effort (need a WMS-capable map client or manual tile-request construction), which StormLens has already solved. | Free indefinitely as Government of Canada open data; no commercial paywall. |
Sources: [MSC GeoMet radar layers documentation](https://eccc-msc.github.io/open-data/msc-data/obs_radar/readme_radar_geomet_en/), [MSC GeoMet usage overview](https://eccc-msc.github.io/open-data/usage/readme_en/), [MSC GeoMet OGC API home](https://api.weather.gc.ca/) |

### Recommendation

**Keep the current MapTiler Weather SDK + ECCC GeoMet stack as the backbone, and treat RainViewer's free Weather Maps API as a low-risk supplemental/fallback radar layer rather than a replacement.** ECCC GeoMet remains unambiguously the best source for authoritative Canadian observed radar, precip-type, HRDPS forecast precipitation, lightning density, and AQHI — it is free, official, and already what Canada's own WeatherCAN app uses ([MSC GeoMet docs](https://eccc-msc.github.io/open-data/usage/readme_en/)), so there is no reason to replace it. MapTiler's Weather SDK is likewise a good fit for smooth, 60fps global animated layers at no cost on StormLens's traffic level. The one genuine gap is **redundancy/uptime and global (non-Canada) radar coverage for travelling users**: RainViewer's keyless, zero-registration public tile endpoint (`api.rainviewer.com/public/weather-maps.json`) can be wired in as a same-day, near-zero-effort supplemental radar layer — useful as an automatic fallback if a GeoMet WMS request fails, or as a lightweight "global radar" option when a Calgary user travels outside Canada — without adding cost, an API key, or a new SDK dependency, since it's just XYZ tiles ([RainViewer API docs](https://www.rainviewer.com/api.html)). Windy's API is not worth pursuing at all for production (the free tier's data is deliberately randomized, and the paid tier at ~€990-1,990/year is expensive for marginal benefit over what StormLens already has). Tomorrow.io should remain exactly as currently planned — an **optional supplement** for its 14-day thunderstorm-probability and lightning-density layers via the already-built `/api/tomorrow-tile` route — since its free tier (500 calls/day) is thin but sufficient for a single-region app if requests are cached server-side, and it is not meant to replace ECCC as the primary Canadian radar source. Xweather's Canada-specific free 15,000-accesses/month, no-card, no-expiry tier is the strongest candidate if StormLens wants a low-cost path to genuine point-source lightning-strike data (as already scaffolded in `PREMIUM_APIS.md`) rather than the density/probability proxies Tomorrow.io and ECCC provide. OpenWeatherMap, WeatherAPI.com, and Meteomatics offer no compelling advantage over the existing stack for radar specifically and are better reserved as niche fallbacks (OpenWeatherMap for its free AI natural-language summary feature under Part 1's synthesis, not for radar tiles).

---

## Source List (all URLs cited above)

- https://support.apple.com/en-us/105038
- https://support.apple.com/en-us/102594
- https://ios.gadgethacks.com/how-to/your-iphones-weather-app-just-got-14-major-new-features-0385062/
- https://apps.apple.com/us/app/weather/id1069513131
- https://9to5mac.com/2026/06/17/apple-weather-gets-two-brand-new-features-in-ios-27/
- https://www.macrumors.com/guide/ios-27-weather/
- https://www.macrumors.com/2025/06/10/ios-26-severe-weather-predicted-destinations/
- https://support.apple.com/guide/iphone/manage-weather-notifications-iph39ae9474a/ios
- https://support.apple.com/guide/iphone/use-weather-widgets-iph8bf15cb61/ios
- https://www.idropnews.com/how-to/iphone-weather-app-settings-to-turn-on/265743/
- https://support.google.com/pixelphone/answer/15266029?hl=en
- https://www.phonearena.com/news/google-releases-pixel-weather-app-for-pixels-6-and-newer-including-the-tablet_id164299
- https://www.androidpolice.com/google-new-weather-experience-nowcast/
- https://asoasis.tech/news/2026-03-13-1154-google-weather/
- https://lifehacker.com/tech/get-the-most-out-of-googles-pixel-weather-app
- https://apps.apple.com/gb/app/weather-the-weather-channel/id295646461
- https://play.google.com/store/apps/details?id=com.weather.Weather&hl=en_US
- https://appsthunder.com/weather-apps-forecasts-2025/
- https://appadvice.com/tv/app/weather-the-weather-channel/295646461
- https://www.weathercompany.com/blog/your-premium-subscription-just-got-a-major-upgrade/
- https://api.windy.com/point-forecast/pricing
- https://api.windy.com/map-forecast/pricing
- https://account.windy.com/agreements/windy-api-map-and-point-forecast-terms-of-use
- https://community.windy.com/topic/18397/want-to-apply-for-api-subscription
- https://community.windy.com/topic/40834/animation-speed-controls
- https://www.windy.com/articles/36164
- https://community.windy.com/topic/31309/windy-s-version-41-is-here-and-brings-new-features
- https://screensdesign.com/showcase/windycom-weather-radar
- https://www.rainviewer.com/api.html
- https://www.rainviewer.com/api/weather-maps-api.html
- https://www.rainviewer.com/blog/all-new-radar-animation-player.html
- https://www.rainviewer.com/blog/share-rain-radar-animation.html
- https://www.rainviewer.com/blog/rainviewer-released-weather-widgets-radar-map.html
- https://apps.apple.com/us/app/rainviewer-noaa-weather-radar/id980123924
- https://www.rainviewer.com/blog/weather-radar-apis-2025-overview.html
- https://www.rainviewer.com/api/transition-faq.html
- https://www.rainviewer.com/sources.html
- https://github.com/rainviewer/rainviewer-api-example
- https://myradar.com/
- https://play.google.com/store/apps/details?id=com.acmeaom.android.myradar&hl=en_US
- https://apps.apple.com/us/app/myradar-accurate-weather-radar/id322439990
- https://www.reddit.com/r/MyRadar/comments/170zldh/premium_vs_free/
- https://techcrunch.com/2023/03/15/carrot-weather-app-new-chatbot-with-chatgpt-update/
- https://support.meetcarrot.com/weather/
- https://screensdesign.com/showcase/carrot-weather-alerts-radar
- https://play.google.com/store/apps/details?id=com.grailr.carrotweather&hl=en_GB
- https://www.tapsmart.com/features/deep-dive-carrot-weather/
- https://9to5mac.com/2023/03/15/carrot-weather-with-chatgpt-snark/
- https://apidev.accuweather.com/developers/forecasts/general
- https://play.google.com/store/apps/details?id=com.accuweather.android&hl=en_US
- https://www.accuweather.com/en/press/49568860
- https://www.accuweather.com/en/press/accuweather-launches-improved-app-with-over-50-new-and-enhanced-features/1809373
- https://www.canada.ca/en/mobile/weathercan.html
- https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/weathercan.html
- https://www.canada.ca/en/environment-climate-change/news/2024/10/changes-are-coming-to-weathercan-canadas-official-weather-application.html
- https://www.canada.ca/en/environment-climate-change/news/2025/11/government-of-canada-announces-new-weather-alert-system-to-help-protect-canadians-in-extreme-weather.html
- https://www.canada.ca/en/environment-climate-change/news/2026/08/government-of-canada-launches-improvements-to-tornado-and-thunderstorm-warnings-to-help-keep-people-in-canada-safe.html
- https://design.canada.ca/research-summaries/weather-research-summary.html
- https://eccc-msc.github.io/open-data/usage/readme_en/
- https://eccc-msc.github.io/open-data/msc-data/obs_radar/readme_radar_geomet_en/
- https://api.weather.gc.ca/
- https://open-meteo.com/en/docs/air-quality-api
- https://open-meteo.com/en/features
- https://open-meteo.com/en/docs/historical-weather-api
- https://open-meteo.com/en/terms
- https://open-meteo.com/en/pricing
- https://dev.to/0012303/open-meteo-has-a-free-weather-api-no-key-no-signup-real-forecast-data-2nna
- https://openweathermap.medium.com/openweather-one-call-api-3-0-introducing-human-readable-weather-summaries-425d16942b5c
- https://openweathermap.org/price
- https://openweathermap.org/api/one-call-3
- https://openweathermap.org/api/one-call-4
- https://openweathermap.org/full-price
- https://support.tomorrow.io/hc/en-us/articles/20273728362644-Free-API-Plan-Rate-Limits
- https://support.tomorrow.io/hc/en-us/articles/23554984091156-Tomorrow-io-Pricing-Overview
- https://docs.tomorrow.io/reference/weather-data-layers
- https://www.tomorrow.io/weather-api/weather-maps-api/
- https://support.tomorrow.io/hc/en-us/articles/38448979426452-Tomorrow-io-Platform-Map-Layers-Visualization-of-Weather-Parameters
- https://support.tomorrow.io/hc/en-us/articles/38449058009748-Thunderstorm-Probability-Core-Feature-Included
- https://www.xweather.com/products/weather-api
- https://www.xweather.com/pricing/weather-api-pay-as-you-go
- https://www.rfp.wiki/specialty-industries/energy-utilities-software/weather-data-solutions-for-energy-and-utilities/meteomatics/xweather
- https://apio.sh/apis/weatherapi
- https://hypereal.tech/a/top-weather-api
- https://dataglobehub.com/api-finder/weatherapi/
- https://www.meteomatics.com/en/sign-up-weather-api-free-basic-account/
- https://www.meteomatics.com/en/pricing/
- https://www.maptiler.com/weather/
- https://docs.maptiler.com/sdk-js/modules/weather/
- https://docs.maptiler.com/sdk-js/examples/weather-radar/
- https://www.maptiler.com/news/2023/07/free-weather-sdk-and-api-for-web-maps-apps/
- https://launcheurope.eu/en/business/products/digital/maptiler/
