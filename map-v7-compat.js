(() => {
  if (!window.maptilerweather?.WindLayer || window.maptilerweather.__stormlensWindTuned) return;
  const OriginalWindLayer = window.maptilerweather.WindLayer;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;

  class StormLensWindLayer extends OriginalWindLayer {
    constructor(options = {}) {
      super({
        ...options,
        density: coarse ? 1.7 : 2.3,
        maxAmount: coarse ? 64 : 128,
        size: coarse ? 1.25 : 1.4,
        speed: 0.00115,
        refreshInterval: coarse ? 950 : 800,
        smooth: true
      });
    }
  }

  window.maptilerweather.WindLayer = StormLensWindLayer;
  window.maptilerweather.__stormlensWindTuned = true;
})();
