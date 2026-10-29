(() => {
  const el = (id) => document.getElementById(id);
  const state = {
    map: null,
    routeClass: null,
    route: null,
    path: [],
    cumulative: [],
    routeMeters: 0,
    progressMeters: 0,
    completedMeters: 0,
    originalMeters: 0,
    lines: [],
    marker: null,
    originMarker: null,
    destinationMarker: null,
    key: sessionStorage.getItem('evCoDriverMapsKey') || '',
    loaded: false,
    refreshing: false,
    driving: false,
    arrived: false,
    lastRefresh: 0,
    refreshEveryMs: 120000,
    origin: '',
    destination: '',
    context: null,
  };
  const mapHost = el('map');
  const keyInput = el('maps-key');
  const status = el('traffic-status');
  keyInput.value = state.key;

  function setStatus(label, kind = '') {
    status.className = `traffic-status ${kind}`;
    status.innerHTML = `<span></span><b>${label}</b>`;
  }

  function showMapMessage(title, detail) {
    mapHost.innerHTML = `<div class="map-empty"><span>ROUTE SIMULATION</span><b>${title}</b><small>${detail}</small></div>`;
  }

  function loadGoogleMaps(key) {
    if (state.loaded && window.google?.maps) return Promise.resolve();
    if (window.__evMapsPromise) return window.__evMapsPromise;
    window.__evMapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        delete window.__evGoogleMapsReady;
        if (error) reject(error);
        else resolve();
      };
      window.__evGoogleMapsReady = () => finish();
      const timeout = setTimeout(() => finish(new Error('Google Maps did not finish loading. Check the API key, billing, and site restrictions.')), 20000);
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__evGoogleMapsReady`;
      script.async = true;
      script.onerror = () => finish(new Error('Google Maps could not load. Check internet access and the API key.'));
      document.head.appendChild(script);
    }).then(async () => {
      await google.maps.importLibrary('maps');
      await google.maps.importLibrary('geometry');
      state.routeClass = (await google.maps.importLibrary('routes')).Route;
      mapHost.innerHTML = '';
      state.map = new google.maps.Map(mapHost, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });
      state.loaded = true;
      setStatus('GOOGLE MAP READY', 'connected');
      el('map-location').textContent = 'Choose a start and destination';
    }).catch((error) => {
      window.__evMapsPromise = null;
      throw error;
    });
    return window.__evMapsPromise;
  }

  function coordinate(point, axis) {
    return typeof point[axis] === 'function' ? point[axis]() : point[axis];
  }

  function distanceBetween(a, b) {
    const rad = (degrees) => degrees * Math.PI / 180;
    const dLat = rad(coordinate(b, 'lat') - coordinate(a, 'lat'));
    const dLng = rad(coordinate(b, 'lng') - coordinate(a, 'lng'));
    const lat1 = rad(coordinate(a, 'lat'));
    const lat2 = rad(coordinate(b, 'lat'));
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function routeLocationAt(meters) {
    if (!state.path.length) return null;
    const target = Math.max(0, Math.min(state.routeMeters, meters));
    let index = 1;
    while (index < state.cumulative.length && state.cumulative[index] < target) index++;
    if (index >= state.path.length) return state.path[state.path.length - 1];
    const start = state.path[index - 1];
    const end = state.path[index];
    const span = state.cumulative[index] - state.cumulative[index - 1];
    const fraction = span ? (target - state.cumulative[index - 1]) / span : 0;
    return new google.maps.LatLng(
      coordinate(start, 'lat') + (coordinate(end, 'lat') - coordinate(start, 'lat')) * fraction,
      coordinate(start, 'lng') + (coordinate(end, 'lng') - coordinate(start, 'lng')) * fraction,
    );
  }

  function trafficLevel(route) {
    const speeds = (route.speedPaths || []).map((segment) => String(segment.speed || '').toUpperCase());
    if (speeds.includes('TRAFFIC_JAM')) return 'HEAVY';
    if (speeds.includes('SLOW')) return 'SLOW';
    return speeds.length ? 'NORMAL' : 'UNKNOWN';
  }

  function formatDuration(milliseconds) {
    const minutes = Math.max(1, Math.round((milliseconds || 0) / 60000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
  }

  function removeLines() {
    state.lines.forEach((line) => line.setMap(null));
    state.lines = [];
  }

  function drawRoute(route, reroute = false) {
    removeLines();
    state.lines = route.createPolylines();
    state.lines.forEach((line) => line.setMap(state.map));
    state.path = route.path || [];
    state.cumulative = [0];
    for (let i = 1; i < state.path.length; i++) {
      state.cumulative.push(state.cumulative[i - 1] + distanceBetween(state.path[i - 1], state.path[i]));
    }
    state.routeMeters = state.cumulative.at(-1) || route.distanceMeters || 0;
    if (state.originalMeters === 0) state.originalMeters = route.distanceMeters || state.routeMeters;
    if (!reroute) {
      if (state.originMarker) state.originMarker.setMap(null);
      state.originMarker = new google.maps.Marker({ map: state.map, position: routeLocationAt(0), title: state.origin, label: 'A' });
    }
    if (!state.marker) {
      state.marker = new google.maps.Marker({
        map: state.map,
        position: routeLocationAt(0),
        title: 'Simulated EV position',
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, fillColor: '#b7f969', fillOpacity: 1, strokeColor: '#10211e', strokeWeight: 2 },
        zIndex: 10,
      });
    } else {
      state.marker.setPosition(routeLocationAt(0));
    }
    if (state.destinationMarker) state.destinationMarker.setMap(null);
    state.destinationMarker = new google.maps.Marker({ map: state.map, position: routeLocationAt(state.routeMeters), title: state.destination, label: 'B' });
    if (route.viewport) state.map.fitBounds(route.viewport, 64);
    else state.map.setCenter(state.path[0]);
  }

  function sendContext(route, reroute = false) {
    const level = trafficLevel(route);
    const duration = route.durationMillis || 0;
    const staticDuration = route.staticDurationMillis || duration;
    const remaining = Math.max(0, (route.distanceMeters || state.routeMeters) / 1000);
    const now = new Date();
    state.context = {
      provider: 'Google Maps Routes',
      traffic_level: level,
      origin: state.origin,
      destination: state.destination,
      remaining_km: Number(remaining.toFixed(2)),
      traffic_eta_minutes: Math.round(duration / 60000),
      typical_eta_minutes: Math.round(staticDuration / 60000),
      traffic_delay_minutes: Math.max(0, Math.round((duration - staticDuration) / 60000)),
      progress_km: Number((state.completedMeters / 1000).toFixed(2)),
      updated_at: now.toISOString(),
      reroute: Boolean(reroute),
      advisory_only: true,
    };
    el('route-eta').textContent = formatDuration(duration);
    el('route-distance').textContent = `${remaining.toFixed(1)} km`;
    el('route-updated').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el('arrival-soc').textContent = '—*';
    el('route-coach-message').textContent = level === 'HEAVY'
        ? 'Heavy traffic is marked on this route. ECO may reduce simulated traction demand; regeneration remains unchanged.'
      : level === 'SLOW'
        ? 'Slow traffic is marked on this route. ECO may help limit simulated energy use in stop-and-go movement.'
        : level === 'NORMAL'
          ? 'Traffic is flowing on this route. Continue smoothly in your current mode.'
          : 'Route loaded. Traffic detail was not returned for this request.';
    setStatus(level === 'UNKNOWN' ? 'ROUTE READY · TRAFFIC UNKNOWN' : `${level} TRAFFIC · AUTO UPDATES WHILE DRIVING`, level === 'HEAVY' ? 'heavy' : level === 'SLOW' ? 'slow' : 'connected');
    if (window.onRouteContextChange) window.onRouteContextChange({ ...state.context, traffic_level: level });
  }

  async function computeRoute(origin, destination, reroute = false) {
    if (!state.routeClass) throw new Error('Connect Google Maps before requesting a route.');
    if (state.refreshing) return;
    state.refreshing = true;
    setStatus(reroute ? 'UPDATING TRAFFIC…' : 'CALCULATING ROUTE…');
    try {
      const { routes } = await state.routeClass.computeRoutes({
        origin,
        destination,
        travelMode: 'DRIVING',
        routingPreference: 'TRAFFIC_AWARE',
        extraComputations: ['TRAFFIC_ON_POLYLINE'],
        fields: ['path', 'speedPaths', 'routeLabels', 'distanceMeters', 'durationMillis', 'staticDurationMillis', 'viewport'],
      });
      if (!routes?.length) throw new Error('No drivable route was found. Check the locations and try again.');
      const route = routes[0];
      state.route = route;
      if (!reroute) {
        state.progressMeters = 0;
        state.completedMeters = 0;
        state.originalMeters = route.distanceMeters || 0;
        state.arrived = false;
      } else {
        state.completedMeters += state.progressMeters;
        state.progressMeters = 0;
      }
      drawRoute(route, reroute);
      sendContext(route, reroute);
      state.lastRefresh = Date.now();
      return route;
    } finally {
      state.refreshing = false;
    }
  }

  function reportProgress() {
    if (!state.route || !state.path.length) return;
    const location = routeLocationAt(state.progressMeters);
    state.marker?.setPosition(location);
    const headingPoint = routeLocationAt(Math.min(state.routeMeters, state.progressMeters + 35));
    if (headingPoint && state.marker) {
      const heading = google.maps.geometry?.spherical?.computeHeading?.(location, headingPoint);
      if (Number.isFinite(heading)) state.marker.setIcon({ path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, fillColor: '#b7f969', fillOpacity: 1, strokeColor: '#10211e', strokeWeight: 2, rotation: heading });
    }
    const totalProgress = state.completedMeters + state.progressMeters;
    const remaining = Math.max(0, state.routeMeters - state.progressMeters);
    const percent = state.originalMeters ? Math.min(100, totalProgress / state.originalMeters * 100) : 0;
    const context = { progressKm: totalProgress / 1000, remainingKm: remaining / 1000, percent };
    if (window.onRouteProgress) window.onRouteProgress(context);
    if (remaining <= 1 && !state.arrived) {
      state.arrived = true;
      state.driving = false;
      setStatus('DESTINATION REACHED', 'connected');
      el('map-location').textContent = `Arrived · ${state.destination}`;
    }
  }

  function tick(isDriving, speedKph, dtSeconds) {
    state.driving = Boolean(isDriving && state.route && !state.arrived);
    if (state.driving && state.routeMeters > state.progressMeters) {
      state.progressMeters = Math.min(state.routeMeters, state.progressMeters + Math.max(0, speedKph) / 3.6 * dtSeconds);
    }
    reportProgress();
    if (state.driving && Date.now() - state.lastRefresh >= state.refreshEveryMs && !state.refreshing) {
      const current = routeLocationAt(state.progressMeters);
      const currentOrigin = current ? { lat: current.lat(), lng: current.lng() } : null;
      if (currentOrigin) computeRoute(currentOrigin, state.destination, true).catch((error) => {
        setStatus('TRAFFIC REFRESH FAILED · LAST ROUTE KEPT', 'slow');
        el('route-coach-message').textContent = `${error.message} The last route remains on screen.`;
      });
    }
  }

  el('navigate').addEventListener('click', async () => {
    state.origin = el('route-origin').value.trim();
    state.destination = el('route-destination').value.trim();
    if (!state.origin || !state.destination) {
      setStatus('ENTER BOTH LOCATIONS', 'slow');
      return;
    }
    if (!state.key) {
      document.querySelector('.map-setup').open = true;
      setStatus('MAP KEY REQUIRED', 'slow');
      showMapMessage('Add your Google Maps API key below.', 'The key stays in this browser session and is sent directly to Google Maps.');
      return;
    }
    try {
      await loadGoogleMaps(state.key);
      await computeRoute(state.origin, state.destination);
    } catch (error) {
      setStatus('ROUTE UNAVAILABLE', 'slow');
      if (!state.map) showMapMessage('Could not calculate this route.', error.message);
      else el('route-coach-message').textContent = `${error.message} Your existing map remains available.`;
    }
  });

  el('save-maps-key').addEventListener('click', async () => {
    state.key = keyInput.value.trim();
    if (!state.key) {
      setStatus('PASTE A RESTRICTED API KEY', 'slow');
      return;
    }
    sessionStorage.setItem('evCoDriverMapsKey', state.key);
    try {
      await loadGoogleMaps(state.key);
      document.querySelector('.map-setup').open = false;
      setStatus('GOOGLE MAP READY', 'connected');
    } catch (error) {
      setStatus('MAP CONNECTION FAILED', 'slow');
      showMapMessage('Google Maps did not connect.', `${error.message} Confirm billing, enabled APIs, and localhost referrer restrictions.`);
    }
  });

  window.RouteMap = { tick, getContext: () => state.context };
  if (state.key) loadGoogleMaps(state.key).catch(() => setStatus('MAP CONNECTION FAILED', 'slow'));
})();
