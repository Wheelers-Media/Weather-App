(() => {
  const weather = window.maptilerweather;
  if (!weather || weather.__stormlensVisualTuned) return;

  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const lowPower = coarse || Math.min(window.innerWidth || 0, window.innerHeight || 0) < 900;

  function wrap(name, defaultsFactory) {
    const Original = weather[name];
    if (!Original) return;
    class StormLensLayer extends Original {
      constructor(options = {}) {
        super({ ...options, ...defaultsFactory(options) });
      }
    }
    Object.defineProperty(StormLensLayer, 'name', { value:`StormLens${name}` });
    weather[name] = StormLensLayer;
  }

  const smoothRaster = () => ({
    smooth:true,
    localSmoothing:true,
    nbSmoothingBins:lowPower ? 6 : 12,
    maxSmoothingDistance:lowPower ? 4 : 7,
    smoothingDistanceDecayFactor:18,
    loadLowerZoomLevels:true,
    interpolateTileEdge:true,
    repaintOnPausedAnimation:false
  });

  wrap('RadarLayer', smoothRaster);
  wrap('PrecipitationLayer', smoothRaster);
  wrap('TemperatureLayer', smoothRaster);
  wrap('PressureLayer', smoothRaster);

  wrap('WindLayer', () => ({
    smooth:true,
    localSmoothing:true,
    nbSmoothingBins:lowPower ? 4 : 8,
    loadLowerZoomLevels:true,
    interpolateTileEdge:true,
    density:coarse ? 1.7 : 2.3,
    maxAmount:coarse ? 64 : 128,
    size:coarse ? 1.25 : 1.4,
    speed:0.00115,
    refreshInterval:coarse ? 950 : 800,
    repaintOnPausedAnimation:false
  }));

  weather.__stormlensVisualTuned = true;
})();
