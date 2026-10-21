(function () {
  'use strict';
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  var JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

  var demo = location.search.indexOf('demo=1') !== -1;
  var mapEl = document.getElementById('map');
  var statusEl = document.getElementById('map-status');
  var listEl = document.getElementById('list');
  var map = null, markers = {}, pendingId = null;

  if (demo) document.getElementById('demo-banner').hidden = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function hasCoords(p) {
    return typeof p.latitude === 'number' && typeof p.longitude === 'number' &&
      p.latitude > 30 && p.latitude < 38 && p.longitude > 7 && p.longitude < 12;
  }
  function byFr(a, b) { return a.localeCompare(b, 'fr'); }

  function entry(p) {
    var li = document.createElement('li');
    var box = hasCoords(p) ? el('button', 'place') : el('div', 'place');
    if (box.tagName === 'BUTTON') {
      box.type = 'button';
      box.addEventListener('click', function () { selectPlace(p.id); });
    }
    box.appendChild(el('span', 'name', p.name));
    if (p.address) box.appendChild(el('span', 'addr', p.address));
    if (p.comment) box.appendChild(el('span', 'comment', p.comment));
    li.appendChild(box);
    return li;
  }

  function renderList(places) {
    listEl.textContent = '';
    if (!places.length) {
      listEl.appendChild(el('p', '', 'Aucun établissement n’est encore répertorié.'));
      return;
    }
    var cities = {};
    places.forEach(function (p) {
      var c = p.city || 'Autres';
      (cities[c] = cities[c] || []).push(p);
    });
    Object.keys(cities).sort(byFr).forEach(function (city) {
      listEl.appendChild(el('h2', '', city));
      var items = cities[city].sort(function (a, b) { return byFr(a.name, b.name); });
      if (city === 'Tunis') {
        var groups = {};
        items.forEach(function (p) {
          var n = p.neighborhood || '';
          (groups[n] = groups[n] || []).push(p);
        });
        Object.keys(groups).sort(function (a, b) {
          if (!a) return -1; if (!b) return 1; return byFr(a, b);
        }).forEach(function (n) {
          if (n) listEl.appendChild(el('h3', '', n));
          var ul = document.createElement('ul');
          groups[n].forEach(function (p) { ul.appendChild(entry(p)); });
          listEl.appendChild(ul);
        });
      } else {
        var ul = document.createElement('ul');
        items.forEach(function (p) { ul.appendChild(entry(p)); });
        listEl.appendChild(ul);
      }
    });
  }

  function popupNode(p) {
    var d = document.createElement('div');
    d.appendChild(el('strong', '', p.name));
    if (p.address) d.appendChild(el('p', '', p.address));
    if (p.comment) d.appendChild(el('p', '', p.comment));
    return d;
  }

  function selectPlace(id) {
    if (!map) { pendingId = id; return; }
    var m = markers[id];
    if (!m) return;
    mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 14));
    m.openPopup();
  }

  function initMap(places) {
    var tilesOk = false;
    map = L.map(mapEl).setView([33.9, 9.5], 6);
    var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    tiles.on('tileload', function () { tilesOk = true; statusEl.textContent = ''; });
    tiles.on('tileerror', function () {
      if (!tilesOk) statusEl.textContent = 'Le fond de carte n’a pas pu être chargé (connexion lente ou indisponible). La liste ci-dessous reste utilisable.';
    });
    var group = [];
    places.forEach(function (p) {
      if (!hasCoords(p)) return;
      var m = L.marker([p.latitude, p.longitude]).addTo(map).bindPopup(popupNode(p));
      markers[p.id] = m;
      group.push(m.getLatLng());
    });
    if (group.length) map.fitBounds(L.latLngBounds(group), { padding: [30, 30], maxZoom: 12 });
    statusEl.textContent = '';
    if (pendingId) { selectPlace(pendingId); pendingId = null; }
  }

  function loadLeaflet(ok, fail) {
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = LEAFLET_CSS;
    css.integrity = CSS_SRI; css.crossOrigin = '';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = LEAFLET_JS; js.integrity = JS_SRI; js.crossOrigin = '';
    js.onload = ok; js.onerror = fail;
    document.head.appendChild(js);
  }

  fetch(demo ? 'data/places.demo.json' : 'data/places.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (places) {
      renderList(places);
      loadLeaflet(function () { initMap(places); }, function () {
        statusEl.textContent = 'La carte n’a pas pu être chargée. La liste ci-dessous reste utilisable.';
      });
    })
    .catch(function () {
      listEl.textContent = '';
      listEl.appendChild(el('p', '', 'Les données ne sont pas disponibles pour le moment. Réessayez plus tard.'));
      statusEl.textContent = 'La carte est indisponible car les données n’ont pas pu être chargées.';
    });
})();
