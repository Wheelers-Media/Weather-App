(() => {
  function loadPremiumDataEnhancements() {
    if (!document.querySelector('link[data-premium-data]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'premium-data.css?v=20260812-1';
      css.dataset.premiumData = 'true';
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[data-premium-home]')) {
      const script = document.createElement('script');
      script.src = 'premium-home.js?v=20260812-1';
      script.dataset.premiumHome = 'true';
      script.async = true;
      document.body.appendChild(script);
    }
    if (!document.querySelector('script[data-premium-lightning]')) {
      const script = document.createElement('script');
      script.src = 'premium-lightning.js?v=20260812-1';
      script.dataset.premiumLightning = 'true';
      script.async = true;
      document.body.appendChild(script);
    }
  }

  function premium() { return window.StormLensPremiumOverlays; }
  function openMap() {
    const nav = document.querySelector('.nav-item[data-target="map"]');
    if (nav) nav.click();
  }

  loadPremiumDataEnhancements();

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
