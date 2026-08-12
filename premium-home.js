(() => {
  let providerStatus = null;
  let inFlight = false;
  let lastFingerprint = '';

  function loadPlaybackController() {
    if (window.StormLensPlaybackV9 || document.querySelector('script[data-stormlens-playback-v9]')) return;
    const script = document.createElement('script');
    script.src = 'playback-v9.js?v=20260812-1';
    script.async = false;
    script.dataset.stormlensPlaybackV9 = 'true';
    script.addEventListener('error', () => console.warn('[StormLens] playback-v9.js failed to load'), { once:true });
    document.body.appendChild(script);
  }

  async function getProviderStatus() {
    if (providerStatus) return providerStatus;
    try {
      const response = await fetch('/api/provider-status', { cache:'no-store' });
      providerStatus = response.ok ? await response.json() : {};
    } catch (_) { providerStatus = {}; }
    return providerStatus;
  }

  function location() {
    try { return JSON.parse(localStorage.getItem('stormlens-location') || 'null'); }
    catch (_) { return null; }
  }

  function intensity(interval) {
    const dbz = Number(interval?.Dbz || 0);
    if (!Number.isFinite(dbz) || dbz <= 0) return 0;
    if (dbz < 20) return 1;
    if (dbz < 35) return 2;
    if (dbz < 50) return 3;
    if (dbz < 60) return 4;
    return 5;
  }

  function aggregate(intervals) {
    const bins = [];
    for (let start = 0; start < 120; start += 5) {
      const group = intervals.filter(item => Number(item.Minute) >= start && Number(item.Minute) < start + 5);
      const strongest = group.reduce((best, item) => intensity(item) > intensity(best) ? item : best, group[0] || null);
      bins.push({ start, strongest, level:intensity(strongest) });
    }
    return bins;
  }

  function phrase(data) {
    return data?.Summary?.Phrase || data?.Summary?.LongPhrase || data?.Summaries?.[0]?.LongPhrase || data?.Summaries?.[0]?.BriefPhrase || 'Minute-by-minute precipitation guidance is available.';
  }

  function buildCard(data) {
    const intervals = Array.isArray(data?.Intervals) ? data.Intervals : [];
    const bins = aggregate(intervals);
    const wet = bins.filter(bin => bin.level > 0);
    const max = Math.max(1, ...bins.map(bin => bin.level));
    const start = wet.length ? wet[0].start : null;
    const end = wet.length ? wet[wet.length - 1].start + 5 : null;
    const type = wet.find(bin => bin.strongest?.PrecipitationType)?.strongest?.PrecipitationType || '';
    const card = document.createElement('article');
    card.className = 'panel card-pad premium-minutecast-card';
    card.innerHTML = `
      <div class="card-head">
        <div><span class="eyebrow">MINUTE PRECIPITATION</span><h3>${start == null ? 'No precipitation in the next 2 hours' : `${type ? type[0].toUpperCase()+type.slice(1) : 'Precipitation'} ${start === 0 ? 'now' : `in about ${start} min`}`}</h3></div>
        <div class="premium-minute-badge">120 MIN</div>
      </div>
      <p class="premium-minute-summary"></p>
      <div class="premium-minute-bars" aria-label="Minute precipitation intensity"></div>
      <div class="premium-minute-labels"><span>Now</span><span>+30m</span><span>+60m</span><span>+90m</span><span>+120m</span></div>
      <div class="premium-minute-footer"><span>${start == null ? 'Dry signal' : `Approx. window ${start === 0 ? 'now' : `+${start}m`} to +${end}m`}</span><span>AccuWeather MinuteCast</span></div>`;
    card.querySelector('.premium-minute-summary').textContent = phrase(data);
    const bars = card.querySelector('.premium-minute-bars');
    bins.forEach(bin => {
      const bar = document.createElement('span');
      bar.className = `premium-minute-bar level-${bin.level}`;
      bar.style.height = `${bin.level ? Math.max(18, (bin.level / max) * 100) : 5}%`;
      const apiColor = bin.strongest?.SimplifiedColor?.Hex || bin.strongest?.Color?.Hex;
      if (apiColor && /^#[0-9a-f]{6}$/i.test(apiColor)) bar.style.background = apiColor;
      bar.title = `${bin.start}-${bin.start+5} min${bin.strongest?.ShortPhrase ? ` · ${bin.strongest.ShortPhrase}` : ''}`;
      bars.appendChild(bar);
    });
    return card;
  }

  async function enhanceHome() {
    const home = document.getElementById('homeContent');
    if (!home || inFlight || home.querySelector('.premium-minutecast-card')) return;
    const status = await getProviderStatus();
    if (!status.accuweather) return;
    const loc = location();
    if (!loc || !Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) return;
    const fingerprint = `${Number(loc.latitude).toFixed(3)},${Number(loc.longitude).toFixed(3)}`;
    if (lastFingerprint === fingerprint && home.dataset.minuteCastAttempt === fingerprint) return;
    home.dataset.minuteCastAttempt = fingerprint;
    inFlight = true;
    try {
      const response = await fetch(`/api/minutecast?lat=${encodeURIComponent(loc.latitude)}&lon=${encodeURIComponent(loc.longitude)}`, { cache:'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const firstPanel = home.querySelector('article.panel');
      if (!firstPanel || home.querySelector('.premium-minutecast-card')) return;
      firstPanel.insertAdjacentElement('afterend', buildCard(data));
      lastFingerprint = fingerprint;
    } catch (error) {
      console.warn('[StormLens MinuteCast]', error);
    } finally {
      inFlight = false;
    }
  }

  const observer = new MutationObserver(() => setTimeout(enhanceHome, 0));
  const start = () => {
    loadPlaybackController();
    const home = document.getElementById('homeContent');
    if (home) observer.observe(home, { childList:true, subtree:false });
    enhanceHome();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
