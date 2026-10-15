import { useCallback, useEffect, useRef, useState } from 'react';
import { directionsUrl } from '../utils/format';
import { Spinner } from './ui';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const hasGoogleMaps = Boolean(KEY);
const DEFAULT_CENTER = { lat: 22.5726, lng: 88.3639 }; // Kolkata

let loader = null;
/** Loads the Google Maps JS API once. Resolves to window.google.maps. */
export function loadGoogleMaps() {
  if (!KEY) return Promise.reject(new Error('No Google Maps key'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      window.__ffMapsReady = () => resolve(window.google.maps);
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&callback=__ffMapsReady&loading=async&v=weekly`;
      s.async = true;
      s.onerror = () => { loader = null; reject(new Error('Google Maps failed to load')); };
      document.head.appendChild(s);
    });
  }
  return loader;
}

const osmEmbed = (lat, lng, zoom = 0.012) =>
  `https://www.openstreetmap.org/export/embed.html?bbox=${lng - zoom},${lat - zoom},${lng + zoom},${lat + zoom}&layer=mapnik&marker=${lat},${lng}`;

/** Fallback address lookup (OpenStreetMap Nominatim) used only when no Google key is configured. */
async function reverseGeocodeOSM(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { Accept: 'application/json' } });
    const j = await r.json();
    return j.display_name || '';
  } catch { return ''; }
}

/**
 * Pick a location: current position, click / drag on a Google map, or search an address.
 * value = { latitude, longitude, address }.  onChange gets the same shape.
 */
export function MapPicker({ value, onChange, error }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [state, setState] = useState(hasGoogleMaps ? 'loading' : 'fallback');
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');
  const hasPoint = Number.isFinite(Number(value && value.latitude)) && Number.isFinite(Number(value && value.longitude)) && value.latitude !== '' && value.longitude !== '';
  const lat = hasPoint ? Number(value.latitude) : null;
  const lng = hasPoint ? Number(value.longitude) : null;

  const commit = useCallback(async (la, ln, addressHint) => {
    let address = addressHint || '';
    if (!address) {
      if (geocoderRef.current) {
        try {
          const res = await geocoderRef.current.geocode({ location: { lat: la, lng: ln } });
          address = (res.results && res.results[0] && res.results[0].formatted_address) || '';
        } catch { /* keep empty */ }
      } else {
        address = await reverseGeocodeOSM(la, ln);
      }
    }
    onChange({ latitude: Number(la.toFixed(6)), longitude: Number(ln.toFixed(6)), address: address || (value && value.address) || '' });
  }, [onChange, value]);

  // Init Google map
  useEffect(() => {
    if (!hasGoogleMaps) return undefined;
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !mapEl.current) return;
      const center = hasPoint ? { lat, lng } : DEFAULT_CENTER;
      const map = new maps.Map(mapEl.current, { center, zoom: hasPoint ? 16 : 12, streetViewControl: false, mapTypeControl: false, fullscreenControl: false });
      const marker = new maps.Marker({ map, position: hasPoint ? center : null, draggable: true });
      geocoderRef.current = new maps.Geocoder();
      map.addListener('click', (e) => { marker.setPosition(e.latLng); commit(e.latLng.lat(), e.latLng.lng()); });
      marker.addListener('dragend', () => { const p = marker.getPosition(); commit(p.lat(), p.lng()); });
      mapRef.current = map; markerRef.current = marker;
      setState('ready');
    }).catch(() => !cancelled && setState('fallback'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep marker in sync with external changes
  useEffect(() => {
    if (state !== 'ready' || !hasPoint) return;
    markerRef.current.setPosition({ lat, lng });
    mapRef.current.panTo({ lat, lng });
  }, [lat, lng, state, hasPoint]);

  const useCurrent = () => {
    setMsg('');
    if (!navigator.geolocation) return setMsg('Your browser does not support location.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); commit(pos.coords.latitude, pos.coords.longitude); if (mapRef.current) mapRef.current.setZoom(16); },
      (err) => { setLocating(false); setMsg(err.code === 1 ? 'Location permission denied. Pick a point on the map instead.' : 'Could not detect your location. Pick a point on the map instead.'); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setMsg('');
    try {
      if (geocoderRef.current) {
        const res = await geocoderRef.current.geocode({ address: query });
        const r = res.results && res.results[0];
        if (!r) return setMsg('Address not found.');
        commit(r.geometry.location.lat(), r.geometry.location.lng(), r.formatted_address);
        if (mapRef.current) mapRef.current.setZoom(16);
      } else {
        const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`)).json();
        if (!j[0]) return setMsg('Address not found.');
        commit(Number(j[0].lat), Number(j[0].lon), j[0].display_name);
      }
    } catch { setMsg('Address search failed. Try again or enter coordinates.'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={useCurrent} disabled={locating} className="btn-outline whitespace-nowrap">
          {locating ? <Spinner className="h-4 w-4" /> : '📍'} Use my current location
        </button>
        <div role="search" className="flex flex-1 gap-2">
          <input className="input" placeholder="Search an address or area…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search address" />
          <button className="btn-primary" type="button" onClick={search}>Search</button>
        </div>
      </div>
      {msg && <p className="text-sm text-amber-700">{msg}</p>}

      {state !== 'fallback' ? (
        <div className="map-frame relative">
          <div ref={mapEl} className="h-full w-full" />
          {state === 'loading' && <div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Spinner className="h-6 w-6 text-brand-600" /></div>}
        </div>
      ) : (
        <div className="space-y-2">
          {hasPoint ? <iframe title="Selected location" className="map-frame" src={osmEmbed(lat, lng)} loading="lazy" /> : <div className="map-frame flex items-center justify-center p-4 text-center text-sm text-ink-500">Use your current location, search an address, or enter coordinates below.</div>}
          <p className="text-xs text-ink-500">Interactive Google map is off (no API key configured). Coordinates can be typed manually.</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" step="any" placeholder="Latitude" value={value.latitude ?? ''} onChange={(e) => onChange({ ...value, latitude: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Latitude" />
            <input className="input" type="number" step="any" placeholder="Longitude" value={value.longitude ?? ''} onChange={(e) => onChange({ ...value, longitude: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Longitude" />
          </div>
        </div>
      )}
      {hasPoint && <p className="text-xs text-ink-500">Selected: {lat.toFixed(5)}, {lng.toFixed(5)}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/**
 * Read-only map for a service location (+ optional live technician marker) with a directions button.
 */
export function MapView({ latitude, longitude, label = 'Service location', technician, showDirections = true }) {
  const el = useRef(null);
  const techMarker = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState(hasGoogleMaps ? 'loading' : 'fallback');
  const lat = Number(latitude);
  const lng = Number(longitude);
  const valid = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasGoogleMaps || !valid) return undefined;
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !el.current) return;
      const map = new maps.Map(el.current, { center: { lat, lng }, zoom: 15, streetViewControl: false, mapTypeControl: false });
      new maps.Marker({ map, position: { lat, lng }, title: label });
      mapRef.current = map;
      setState('ready');
    }).catch(() => !cancelled && setState('fallback'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  useEffect(() => {
    if (state !== 'ready' || !technician || !Number.isFinite(Number(technician.latitude))) return;
    const maps = window.google.maps;
    const pos = { lat: Number(technician.latitude), lng: Number(technician.longitude) };
    if (!techMarker.current) {
      techMarker.current = new maps.Marker({ map: mapRef.current, position: pos, title: 'Technician', icon: { path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#0b7c78', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } });
      const b = new maps.LatLngBounds(); b.extend(pos); b.extend({ lat, lng }); mapRef.current.fitBounds(b, 60);
    } else techMarker.current.setPosition(pos);
  }, [technician, state, lat, lng]);

  if (!valid) return null;
  return (
    <div className="space-y-2">
      {state !== 'fallback' ? (
        <div className="map-frame relative"><div ref={el} className="h-full w-full" />{state === 'loading' && <div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Spinner className="h-6 w-6 text-brand-600" /></div>}</div>
      ) : (
        <iframe title={label} className="map-frame" src={osmEmbed(lat, lng)} loading="lazy" />
      )}
      {technician && Number.isFinite(Number(technician.latitude)) && state === 'fallback' && (
        <p className="text-xs text-ink-500">Technician last seen at {Number(technician.latitude).toFixed(4)}, {Number(technician.longitude).toFixed(4)}</p>
      )}
      {showDirections && (
        <a className="btn-outline btn-sm" href={directionsUrl(lat, lng)} target="_blank" rel="noopener noreferrer">🧭 Get directions</a>
      )}
    </div>
  );
}
