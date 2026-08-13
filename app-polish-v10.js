(() => {
  'use strict';

  const DEFAULT_LOCATION = {
    name:'Calgary', admin1:'Alberta', country:'Canada', countryCode:'CA', provinceCode:'AB',
    latitude:51.0447, longitude:-114.0719, timezone:'America/Edmonton', source:'default'
  };

  const $ = q => document.querySelector(q);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let searchTimer = null;
  let searchAbort = null;

  function refreshIcons() {
    if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
  }

  function provinceCode(name) {
    const key=String(name||'').trim().toLowerCase();
    return ({
      'alberta':'AB','british columbia':'BC','manitoba':'MB','new brunswick':'NB',
      'newfoundland and labrador':'NL','northwest territories':'NT','nova scotia':'NS',
      'nunavut':'NU','ontario':'ON','prince edward island':'PE','quebec':'QC',
      'saskatchewan':'SK','yukon':'YT'
    })[key] || '';
  }

  function cleanModeLabel() {
    const label = $('#radarModeLabel');
    if (!label) return;
    const clean = label.textContent.replace(/\s*·\s*SMOOTH\b/gi, '').trim();
    if (clean !== label.textContent) label.textContent = clean;
  }

  function observeModeLabel() {
    const label = $('#radarModeLabel');
    if (!label) return;
    cleanModeLabel();
    new MutationObserver(cleanModeLabel).observe(label, { childList:true, characterData:true, subtree:true });
  }

  function contextByPrefix(feature, prefixes) {
    const context = feature?.context || [];
    return context.find(item => prefixes.some(prefix => String(item.id || '').startsWith(prefix))) || null;
  }

  function mapTilerLocation(feature) {
    const region = contextByPrefix(feature, ['region.','state.','province.']);
    const country = contextByPrefix(feature, ['country.']);
    const [longitude, latitude] = feature.center || [];
    const name = feature.text || feature.place_name?.split(',')[0] || 'Selected location';
    const admin1 = region?.text || '';
    const countryName = country?.text || '';
    const countryCode = String(country?.country_code || feature.properties?.country_code || '').toUpperCase();
    return {
      name,
      admin1,
      country:countryName,
      countryCode,
      provinceCode:provinceCode(admin1),
      latitude:Number(latitude),
      longitude:Number(longitude),
      timezone:'auto',
      source:'address-search',
      address:feature.place_name || name
    };
  }

  function saveAndSelectLocation(loc) {
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
    let saved=[];
    try { saved=JSON.parse(localStorage.getItem('stormlens-saved') || '[]') || []; } catch (_) {}
    const duplicate=saved.some(item => Math.abs(Number(item.latitude)-loc.latitude)<.0005 && Math.abs(Number(item.longitude)-loc.longitude)<.0005);
    if (!duplicate) saved.unshift(loc);
    localStorage.setItem('stormlens-saved', JSON.stringify(saved.slice(0,20)));
    localStorage.setItem('stormlens-location', JSON.stringify(loc));
    localStorage.setItem('stormlens-location-choice-v1', 'search');
    window.location.reload();
  }

  function renderSearchResults(features) {
    const box = $('#searchResults');
    if (!box) return;
    if (!features.length) {
      box.innerHTML='<div class="search-result"><span><strong>No places found</strong><small>Try a city, street address, postal code or landmark</small></span></div>';
      return;
    }
    box.innerHTML=features.map((feature,index) => {
      const type=(feature.place_type_name?.[0] || feature.place_type?.[0] || 'Place').replace(/_/g,' ');
      const title=feature.text || feature.place_name?.split(',')[0] || 'Location';
      const detail=feature.place_name || '';
      return `<button class="search-result" data-maptiler-result="${index}">
        <span class="result-icon"><i data-lucide="map-pin"></i></span>
        <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)} · ${escapeHtml(type)}</small></span>
      </button>`;
    }).join('');
    box.querySelectorAll('[data-maptiler-result]').forEach(button => button.addEventListener('click', () => {
      const feature=features[Number(button.dataset.maptilerResult)];
      if (feature) saveAndSelectLocation(mapTilerLocation(feature));
    }));
    refreshIcons();
  }

  async function openMeteoFallback(query) {
    const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`);
    if (!response.ok) throw new Error('Location search failed');
    const data=await response.json();
    return (data.results || []).map(r => ({
      text:r.name,
      place_name:[r.name,r.admin1,r.country].filter(Boolean).join(', '),
      place_type:['place'], place_type_name:['Place'], center:[r.longitude,r.latitude],
      context:[
        r.admin1 ? {id:'region.fallback',text:r.admin1} : null,
        r.country ? {id:'country.fallback',text:r.country,country_code:r.country_code} : null
      ].filter(Boolean)
    }));
  }

  async function searchPlaces(query) {
    const box=$('#searchResults');
    if (!box) return;
    box.innerHTML='<div class="search-result"><span class="result-icon"><i data-lucide="loader-circle"></i></span><span><strong>Searching…</strong><small>Addresses, towns and places</small></span></div>';
    refreshIcons();
    if (searchAbort) searchAbort.abort();
    searchAbort=new AbortController();
    try {
      const key=window.STORMLENS_PUBLIC_CONFIG?.mapTilerApiKey || '';
      let features=[];
      if (key) {
        let proximity='';
        try {
          const loc=JSON.parse(localStorage.getItem('stormlens-location') || 'null');
          if (loc && Number.isFinite(Number(loc.longitude)) && Number.isFinite(Number(loc.latitude))) proximity=`&proximity=${encodeURIComponent(`${loc.longitude},${loc.latitude}`)}`;
        } catch (_) {}
        const url=`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(key)}&limit=8&language=en&autocomplete=true${proximity}`;
        const response=await fetch(url,{signal:searchAbort.signal});
        if (response.ok) {
          const data=await response.json();
          features=(data.features || []).filter(f => Array.isArray(f.center) && f.center.length>=2);
        } else if (response.status !== 403) {
          throw new Error(`Search returned ${response.status}`);
        }
      }
      if (!features.length) features=await openMeteoFallback(query);
      renderSearchResults(features);
    } catch (error) {
      if (error.name === 'AbortError') return;
      box.innerHTML=`<div class="error-card"><h3>Search unavailable</h3><p>${escapeHtml(error.message || 'Could not search locations.')}</p></div>`;
    }
  }

  function bindAddressSearch() {
    const input=$('#locationSearchInput');
    if (!input || input.dataset.v10AddressSearch) return;
    input.dataset.v10AddressSearch='true';
    input.placeholder='City, address or place';
    document.addEventListener('input', event => {
      if (event.target !== input) return;
      event.stopImmediatePropagation();
      clearTimeout(searchTimer);
      const query=input.value.trim();
      if (query.length < 2) return;
      searchTimer=setTimeout(() => searchPlaces(query),220);
    }, true);
  }

  function sameLocation(a,b) {
    return a && b && Math.abs(Number(a.latitude)-Number(b.latitude))<.0005 && Math.abs(Number(a.longitude)-Number(b.longitude))<.0005;
  }

  function decorateSavedLocations() {
    const list=$('#savedLocationsList');
    if (!list) return;
    const rows=[...list.querySelectorAll('.saved-location-row')];
    rows.forEach(row => {
      if (row.closest('.saved-location-wrap')) return;
      const index=Number(row.dataset.savedIndex);
      let saved=[];
      try { saved=JSON.parse(localStorage.getItem('stormlens-saved') || '[]') || []; } catch (_) {}
      const loc=saved[index];
      const isDefault=loc && sameLocation(loc,DEFAULT_LOCATION);
      const wrap=document.createElement('div');
      wrap.className='saved-location-wrap';
      row.parentNode.insertBefore(wrap,row);
      wrap.appendChild(row);
      if (!isDefault) {
        const remove=document.createElement('button');
        remove.type='button';
        remove.className='saved-location-remove';
        remove.setAttribute('aria-label',`Remove ${loc?.name || 'saved location'}`);
        remove.innerHTML='<i data-lucide="trash-2"></i>';
        remove.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          let current=[];
          try { current=JSON.parse(localStorage.getItem('stormlens-saved') || '[]') || []; } catch (_) {}
          const target=current[index];
          if (!target) return;
          current.splice(index,1);
          localStorage.setItem('stormlens-saved',JSON.stringify(current));
          let selected=null;
          try { selected=JSON.parse(localStorage.getItem('stormlens-location') || 'null'); } catch (_) {}
          if (sameLocation(selected,target)) {
            const next=current[0] || DEFAULT_LOCATION;
            localStorage.setItem('stormlens-location',JSON.stringify(next));
          }
          window.location.reload();
        });
        wrap.appendChild(remove);
      }
    });
    refreshIcons();
  }

  function observeSavedLocations() {
    const list=$('#savedLocationsList');
    if (!list) return;
    decorateSavedLocations();
    new MutationObserver(() => decorateSavedLocations()).observe(list,{childList:true});
  }

  function init() {
    bindAddressSearch();
    observeModeLabel();
    observeSavedLocations();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
