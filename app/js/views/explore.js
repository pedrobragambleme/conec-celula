import { h, icon, tabs, clear, spinner, empty, WEEKDAYS, fmtTime } from '../ui.js';
import { sb, run, uid } from '../sb.js';
import { personLine } from './common.js';

let tab = 'pessoas';

export async function explore(_p, q) {
  if (q.get('tab')) tab = q.get('tab');
  const results = h('div', { class: 'stack' });
  const search = h('input', { type: 'search', placeholder: 'Buscar…', class: 'search', oninput: debounce(() => load(), 350) });
  const tabBox = h('div');
  const paint = () => {
    clear(tabBox, tabs([['pessoas', 'Pessoas'], ['celulas', 'Células'], ['igrejas', 'Igrejas']], tab, (t) => { tab = t; paint(); load(); }));
    search.placeholder = tab === 'pessoas' ? 'Buscar pessoas por nome' : tab === 'celulas' ? 'Bairro, cidade, igreja ou nome da célula' : 'Nome ou cidade da igreja';
  };

  async function load() {
    clear(results, spinner());
    const term = search.value.trim();
    if (tab === 'pessoas') {
      let qq = sb.from('profiles').select('id, full_name, avatar_url, city, username').neq('id', uid()).order('created_at', { ascending: false }).limit(40);
      if (term) qq = qq.or(`full_name.ilike.%${term.replace(/[%,()]/g, '')}%,username.ilike.%${term.replace(/[%,()]/g, '')}%`);
      const people = await run(qq);
      const { data: f } = await sb.from('follows').select('following_id').eq('follower_id', uid());
      const following = new Set((f || []).map((x) => x.following_id));
      clear(results, people.length ? h('div', { class: 'card list' }, people.map((p) =>
        personLine(p, p.city, following.has(p.id) ? h('span', { class: 'badge' }, 'Conectado') : null)))
        : empty('search', 'Ninguém encontrado'));
    } else if (tab === 'celulas') {
      const cells = await run(sb.rpc('find_cells', { p_search: term || null }));
      const mapBox = h('div', { class: 'map', id: 'cells-map' });
      clear(results,
        cells.some((c) => c.lat) ? mapBox : null,
        cells.length ? h('div', { class: 'card list' }, cells.map((c) => h('a', { class: 'list-item', href: `#/celula/${c.id}` },
          h('i', { class: 'dot', style: { background: c.color } }),
          h('div', { class: 'grow' }, h('strong', null, c.name),
            h('small', { class: 'muted' }, [c.church_name, [c.neighborhood, c.city].filter(Boolean).join(', '),
              c.meeting_day !== null ? `${WEEKDAYS[c.meeting_day]}${c.meeting_time ? ' ' + fmtTime(c.meeting_time) : ''}` : null].filter(Boolean).join(' · '))),
          h('span', { class: 'badge' }, `${c.members} 👥`))))
          : empty('cells', 'Nenhuma célula encontrada', 'Tente outro bairro ou cidade.'));
      if (cells.some((c) => c.lat)) drawMap(mapBox, cells.filter((c) => c.lat));
    } else {
      let qq = sb.from('churches').select('id, name, city').order('name').limit(50);
      if (term) qq = qq.or(`name.ilike.%${term.replace(/[%,()]/g, '')}%,city.ilike.%${term.replace(/[%,()]/g, '')}%`);
      const churches = await run(qq);
      clear(results, churches.length ? h('div', { class: 'card list' }, churches.map((c) => h('a', { class: 'list-item', href: `#/igreja/${c.id}` },
        icon('church'), h('div', { class: 'grow' }, h('strong', null, c.name), h('small', { class: 'muted' }, c.city || '')))))
        : empty('church', 'Nenhuma igreja encontrada', null, h('a', { href: '#/nova-igreja', class: 'btn small' }, 'Cadastrar minha igreja')));
    }
  }
  paint();
  load();
  return h('div', { class: 'stack' }, h('h1', { class: 'page-title' }, 'Explorar'), tabBox, search, results);
}

function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

// ---------------------------------------------------------------------
// Mapa (Leaflet + OpenStreetMap), carregado só quando precisa
// ---------------------------------------------------------------------
let leafletReady;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }));
      const s = h('script', { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = () => resolve(window.L); s.onerror = reject;
      document.head.append(s);
    });
  }
  return leafletReady;
}

export async function drawMap(el, cells) {
  const L = await loadLeaflet().catch(() => null);
  if (!L || !el.isConnected) return;
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = cells.map((c) => {
    const m = L.circleMarker([c.lat, c.lng], { radius: 9, color: '#fff', weight: 2, fillColor: c.color || '#E8603C', fillOpacity: 1 }).addTo(map);
    const link = document.createElement('a');
    link.href = `#/celula/${c.id}`; link.textContent = c.name;
    m.bindPopup(link);
    return [c.lat, c.lng];
  });
  if (pts.length === 1) map.setView(pts[0], 14); else map.fitBounds(pts, { padding: [30, 30] });
}

export async function pickLocation(el, initial, onPick) {
  const L = await loadLeaflet();
  const start = initial?.lat ? [initial.lat, initial.lng] : [-15.79, -47.88];
  const map = L.map(el).setView(start, initial?.lat ? 15 : 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  let marker = initial?.lat ? L.marker(start).addTo(map) : null;
  const set = (lat, lng) => {
    // arredonda (~100 m) para não expor o endereço exato no mapa público
    lat = Math.round(lat * 1000) / 1000; lng = Math.round(lng * 1000) / 1000;
    marker ? marker.setLatLng([lat, lng]) : (marker = L.marker([lat, lng]).addTo(map));
    onPick(lat, lng);
  };
  map.on('click', (e) => set(e.latlng.lat, e.latlng.lng));
  return {
    useMyLocation: () => navigator.geolocation?.getCurrentPosition((p) => { map.setView([p.coords.latitude, p.coords.longitude], 15); set(p.coords.latitude, p.coords.longitude); }),
  };
}
