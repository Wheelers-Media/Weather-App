(() => {
  function resizeSoon() {
    [0,80,220,500].forEach(delay => setTimeout(() => {
      try { window.StormLensMapV7?.map?.resize?.(); } catch (_) {}
    }, delay));
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('.nav-item[data-target="map"]')) resizeSoon();
  }, true);

  const screen = document.getElementById('mapScreen');
  if (screen && window.MutationObserver) {
    const observer = new MutationObserver(() => {
      if (screen.classList.contains('active')) resizeSoon();
    });
    observer.observe(screen, { attributes:true, attributeFilter:['class'] });
  }

  window.addEventListener('resize', resizeSoon, { passive:true });
  window.addEventListener('orientationchange', resizeSoon, { passive:true });
  window.addEventListener('pageshow', resizeSoon, { passive:true });
})();
