(() => {
  function premium() { return window.StormLensPremiumOverlays; }
  function openMap() {
    const nav = document.querySelector('.nav-item[data-target="map"]');
    if (nav) nav.click();
  }

  document.addEventListener('click', event => {
    const storm = event.target.closest?.('#openStormMap');
    if (storm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMap();
      setTimeout(() => premium()?.applyPreset?.('storm'), 180);
      return;
    }

    const lightning = event.target.closest?.('#openLightningMap');
    if (lightning) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMap();
      setTimeout(() => premium()?.toggleLayer?.('lightning', true), 180);
    }
  }, true);
})();
