import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Box, ChevronDown, Clock3, Headphones, LocateFixed, Map, Plane, RefreshCw, Search, Volume2, VolumeX, Waypoints } from 'lucide-react'
import { aircraftName, airlineFromCallsign, regions, watchedFlights } from './data'
import { useFlightData } from './hooks/useFlightData'
import { useEngineSound } from './hooks/useEngineSound'
import type { Aircraft, FlightRoute, Region } from './types'
import { clean, distanceNm, feet, knots } from './utils'
import Aircraft3D from './components/Aircraft3D'
import FlightDetails from './components/FlightDetails'
import LiveMap from './components/LiveMap'
import { LogoMark, PlaneGlyph } from './components/Icons'
import Trajectory from './components/Trajectory'
import { useI18n } from './i18n'
import { useFlightRoute } from './hooks/useFlightRoute'
import { fetchOpenSkyAircraft, fetchOpenSkyGlobal } from './services/opensky'
import { searchAirlines, searchPlaces, type AirlineSearchResult, type PlaceSearchResult } from './services/search'

type Tab = 'map' | 'trajectory' | '3d'
type RecentFlight = { aircraft: Aircraft; route: FlightRoute | null; viewedAt: number }
type SearchResult = { aircraft: Aircraft; route: FlightRoute | null; recent?: boolean; remote?: boolean }

const RECENT_FLIGHTS_KEY = 'aeroscope.recentFlights.v1'

function readRecentFlights(): RecentFlight[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_FLIGHTS_KEY) || '[]') as RecentFlight[]
    return Array.isArray(stored) ? stored.filter(item => item?.aircraft?.hex && item.aircraft.flight).slice(0, 6) : []
  } catch {
    return []
  }
}

function persistRecentFlights(flights: RecentFlight[]) {
  try {
    window.localStorage.setItem(RECENT_FLIGHTS_KEY, JSON.stringify(flights))
  } catch {
    // Private browsing or a full storage quota must not block flight selection.
  }
}

function compactCountdown(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}H${minutes.toString().padStart(2, '0')}`
}

function normalizedFlight(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]{2,3})0+(\d)/, '$1$2')
}

function meaningfulOperator(value?: string) {
  const name = value?.trim()
  return name && name !== 'Opérateur non identifié' && name !== 'Unknown operator' ? name : ''
}

function routeSearchText(route: FlightRoute | null) {
  if (!route) return ''
  return [route.airline?.name, route.airline?.iata, route.airline?.icao, route.origin.name, route.origin.municipality, route.origin.iata_code, route.origin.icao_code]
    .filter(Boolean)
    .join(' ')
}

function routeStartsFromPlace(route: FlightRoute, place: PlaceSearchResult, query: string) {
  const origin = route.origin
  const isCountry = place.kind === 'country'
  const searchableOrigin = normalizedFlight((isCountry
    ? [origin.country_name, origin.country_iso_name]
    : [origin.name, origin.municipality, origin.iata_code, origin.icao_code]
  ).filter(Boolean).join(' '))
  const candidates = [query, place.name, place.detail.split(',')[0]]
    .map(normalizedFlight)
    .filter(value => value.length >= 3)
  return candidates.some(candidate => searchableOrigin.includes(candidate))
}

export default function App() {
  const { language, locale, t } = useI18n()
  const [regionId, setRegionId] = useState('paris')
  const [gpsRegion, setGpsRegion] = useState<Region | null>(null)
  const [searchRegion, setSearchRegion] = useState<Region | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(false)
  const region = regionId === 'gps' && gpsRegion ? gpsRegion : regionId === 'search' && searchRegion ? searchRegion : regions.find(item => item.id === regionId) || regions[0]
  const { aircraft, loading, isLive, lastUpdate, refresh, airborne } = useFlightData(region)
  const [selectedHex, setSelectedHex] = useState('')
  const [tab, setTab] = useState<Tab>('map')
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [externalAircraft, setExternalAircraft] = useState<Aircraft | null>(null)
  const [clock, setClock] = useState(Date.now())
  const [mapFocusRequest, setMapFocusRequest] = useState(0)
  const [recentFlights, setRecentFlights] = useState<RecentFlight[]>(readRecentFlights)
  const [routeIndex, setRouteIndex] = useState<Record<string, FlightRoute>>(() => Object.fromEntries(readRecentFlights().flatMap(item => item.route && item.aircraft.flight ? [[normalizedFlight(item.aircraft.flight), item.route]] : [])))
  const [remoteAircraft, setRemoteAircraft] = useState<Aircraft[]>([])
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [airlineResults, setAirlineResults] = useState<AirlineSearchResult[]>([])
  const [remoteSearching, setRemoteSearching] = useState(false)
  const routeRequests = useRef(new Set<string>())
  const searchFieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeSearchResults = (event: PointerEvent) => {
      if (!searchFieldRef.current?.contains(event.target as Node)) setShowResults(false)
    }
    document.addEventListener('pointerdown', closeSearchResults)
    return () => document.removeEventListener('pointerdown', closeSearchResults)
  }, [])

  const chooseRegion = (nextId: string) => {
    if (nextId !== 'gps') {
      setRegionId(nextId)
      return
    }
    if (gpsRegion) {
      setRegionId('gps')
      return
    }
    if (!navigator.geolocation) {
      setGpsError(true)
      return
    }
    setGpsLoading(true)
    setGpsError(false)
    navigator.geolocation.getCurrentPosition(position => {
      setGpsRegion({ id: 'gps', name: t('regionGps'), detail: '100 NM', lat: position.coords.latitude, lon: position.coords.longitude, radius: 100, zoom: 6.8 })
      setRegionId('gps')
      setGpsLoading(false)
    }, () => {
      setGpsLoading(false)
      setGpsError(true)
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 300_000 })
  }

  const displayAircraft = useMemo(() => externalAircraft && !aircraft.some(item => item.hex === externalAircraft.hex)
    ? [externalAircraft, ...aircraft]
    : aircraft, [aircraft, externalAircraft])
  const selected = useMemo(() => displayAircraft.find(item => item.hex === selectedHex) || displayAircraft.find(item => item.flight) || displayAircraft[0], [displayAircraft, selectedHex])
  const fetchedRoute = useFlightRoute(selected?.flight)
  const route = useMemo(() => {
    if (!fetchedRoute || fetchedRoute.callsign.trim().toUpperCase() !== selected?.flight?.trim().toUpperCase()) return null
    if (typeof selected?.lat !== 'number' || typeof selected.lon !== 'number') return fetchedRoute
    const total = distanceNm(fetchedRoute.origin, fetchedRoute.destination)
    const viaAircraft = distanceNm(fetchedRoute.origin, { latitude: selected.lat, longitude: selected.lon })
      + distanceNm({ latitude: selected.lat, longitude: selected.lon }, fetchedRoute.destination)
    return viaAircraft <= Math.max(total * 1.65, total + 350) ? fetchedRoute : null
  }, [fetchedRoute, selected?.flight, selected?.lat, selected?.lon])
  const remainingDistance = useMemo(() => route && typeof selected?.lat === 'number' && typeof selected.lon === 'number'
    ? distanceNm({ latitude: selected.lat, longitude: selected.lon }, route.destination)
    : null, [route, selected?.lat, selected?.lon])
  const sound = useEngineSound(selected?.gs || 350)
  useEffect(() => {
    const searchText = query.trim()
    if (!showResults || searchText.length < 3) {
      setRemoteAircraft([])
      setPlaceResults([])
      setAirlineResults([])
      setRemoteSearching(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRemoteSearching(true)
      void Promise.allSettled([
        searchPlaces(searchText, language, controller.signal),
        searchAirlines(searchText, language, controller.signal),
      ]).then(async ([placesResult, airlinesResult]) => {
        if (controller.signal.aborted) return
        const places = placesResult.status === 'fulfilled' ? placesResult.value : []
        const airlines = airlinesResult.status === 'fulfilled' ? airlinesResult.value : []
        setPlaceResults(places)
        setAirlineResults(airlines)
        const placePromise = places[0] && !airlines[0] ? (async () => {
          const candidates = (await fetchOpenSkyAircraft(places[0].region, controller.signal)).slice(0, 48)
          const matched: Aircraft[] = []
          const discoveredRoutes: Record<string, FlightRoute> = {}
          for (let index = 0; index < candidates.length && !controller.signal.aborted; index += 6) {
            await Promise.all(candidates.slice(index, index + 6).map(async item => {
              const key = normalizedFlight(item.flight || '')
              if (!key) return
              let candidateRoute = routeIndex[key]
              if (!candidateRoute) {
                try {
                  const response = await fetch(`/api/route/${encodeURIComponent(item.flight!.trim())}`, { signal: controller.signal })
                  if (!response.ok) return
                  const payload = await response.json() as { response?: { flightroute?: FlightRoute } }
                  const fetchedCandidateRoute = payload.response?.flightroute
                  if (fetchedCandidateRoute?.origin && fetchedCandidateRoute.destination) {
                    candidateRoute = fetchedCandidateRoute
                    discoveredRoutes[key] = fetchedCandidateRoute
                  }
                } catch {
                  return
                }
              }
              if (candidateRoute && routeStartsFromPlace(candidateRoute, places[0], searchText)) matched.push(item)
            }))
          }
          if (Object.keys(discoveredRoutes).length) setRouteIndex(current => ({ ...current, ...discoveredRoutes }))
          return matched
        })().catch(() => []) : Promise.resolve([])
        const airlinePromise = airlines[0] ? fetchOpenSkyGlobal(controller.signal)
          .then(items => items.filter(item => item.flight?.startsWith(airlines[0].icao)).map(item => ({ ...item, ownOp: airlines[0].name })))
          .catch(() => []) : Promise.resolve([])
        const [placeAircraft, airlineAircraft] = await Promise.all([placePromise, airlinePromise])
        if (controller.signal.aborted) return
        setRemoteAircraft([...airlineAircraft, ...placeAircraft].filter((item, index, list) => list.findIndex(candidate => candidate.hex === item.hex) === index))
      }).finally(() => {
        if (!controller.signal.aborted) setRemoteSearching(false)
      })
    }, 450)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [language, query, showResults])

  const recentResults = useMemo<SearchResult[]>(() => {
    const needle = normalizedFlight(query)
    return recentFlights.filter(item => {
      if (!needle) return true
      const indexedRoute = item.route || routeIndex[normalizedFlight(item.aircraft.flight || '')] || null
      return [item.aircraft.flight, item.aircraft.r, item.aircraft.t, item.aircraft.ownOp, routeSearchText(indexedRoute)]
        .some(value => normalizedFlight(value || '').includes(needle))
    }).map(item => ({ aircraft: item.aircraft, route: item.route || routeIndex[normalizedFlight(item.aircraft.flight || '')] || null, recent: true }))
  }, [query, recentFlights, routeIndex])
  const results = useMemo<SearchResult[]>(() => {
    const needle = normalizedFlight(query)
    const recentKeys = new Set(recentResults.map(item => normalizedFlight(item.aircraft.flight || '')))
    const searchedPlace = placeResults[0]
    const searchedAirline = airlineResults[0]
    const matches = (item: Aircraft) => {
      if (!needle) return true
      const indexedRoute = routeIndex[normalizedFlight(item.flight || '')] || null
      if (searchedAirline) {
        const airlineIcao = normalizedFlight(searchedAirline.icao)
        const routeAirlineIcao = normalizedFlight(indexedRoute?.airline?.icao || '')
        return normalizedFlight(item.flight || '').startsWith(airlineIcao) || routeAirlineIcao === airlineIcao
      }
      if (searchedPlace) return Boolean(indexedRoute && routeStartsFromPlace(indexedRoute, searchedPlace, query))
      return [item.flight, item.r, item.t, item.ownOp, routeSearchText(indexedRoute)]
        .some(value => normalizedFlight(value || '').includes(needle))
    }
    const local = displayAircraft.filter(matches)
    const scheduled = watchedFlights.filter(item => item.aliases?.some(alias => normalizedFlight(alias) === needle))
    return [...local, ...scheduled, ...remoteAircraft]
      .filter((item, index, list) => list.findIndex(candidate => candidate.hex === item.hex) === index)
      .filter(item => !recentKeys.has(normalizedFlight(item.flight || '')))
      .slice(0, needle ? 12 : 8)
      .map(item => ({ aircraft: item, route: routeIndex[normalizedFlight(item.flight || '')] || null, remote: remoteAircraft.some(remote => remote.hex === item.hex) }))
  }, [airlineResults, displayAircraft, placeResults, query, recentResults, remoteAircraft, routeIndex])

  useEffect(() => {
    if (!showResults) return
    let cancelled = false
    const candidates = [...displayAircraft, ...remoteAircraft].filter((item, index, list) => item.flight && typeof item.lat === 'number' && typeof item.lon === 'number' && list.findIndex(candidate => candidate.hex === item.hex) === index).slice(0, 24)
    const enrich = async () => {
      for (let index = 0; index < candidates.length && !cancelled; index += 4) {
        await Promise.all(candidates.slice(index, index + 4).map(async item => {
          const key = normalizedFlight(item.flight || '')
          if (!key || routeRequests.current.has(key) || routeIndex[key]) return
          routeRequests.current.add(key)
          try {
            const response = await fetch(`/api/route/${encodeURIComponent(item.flight!.trim())}`, { signal: AbortSignal.timeout(8_000) })
            if (!response.ok) return
            const payload = await response.json() as { response?: { flightroute?: FlightRoute } }
            const next = payload.response?.flightroute
            if (!cancelled && next?.origin && next?.destination) setRouteIndex(current => ({ ...current, [key]: next }))
          } catch {
            // Missing route metadata should not hide the aircraft from search.
          }
        }))
      }
    }
    void enrich()
    return () => { cancelled = true }
  }, [displayAircraft, remoteAircraft, routeIndex, showResults])

  useEffect(() => {
    if (displayAircraft.length && !displayAircraft.some(item => item.hex === selectedHex)) setSelectedHex(displayAircraft.find(item => item.flight)?.hex || displayAircraft[0].hex)
  }, [displayAircraft, selectedHex])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const callsign = externalAircraft?.adsbCallsign
    if (!callsign) return
    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(`/api/aircraft/callsign/${encodeURIComponent(callsign)}`, { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) return
        const payload = await response.json() as { ac?: Aircraft[] }
        const live = payload.ac?.find(item => typeof item.lat === 'number' && typeof item.lon === 'number')
        if (!live || cancelled) return
        const next: Aircraft = {
          ...externalAircraft,
          ...live,
          flight: externalAircraft.flight,
          ownOp: live.ownOp || externalAircraft.ownOp || airlineFromCallsign(callsign),
          desc: live.desc || externalAircraft.desc || aircraftName(live.t),
          trackingState: 'live',
        }
        setExternalAircraft(next)
        setSelectedHex(next.hex)
      } catch {
        // Keep the scheduled card visible until an ADS-B signal becomes available.
      }
    }
    void poll()
    const timer = window.setInterval(poll, 20_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [externalAircraft?.adsbCallsign])

  useEffect(() => {
    if (!route || !selected?.flight) return
    const key = normalizedFlight(selected.flight)
    setRouteIndex(current => current[key] === route ? current : { ...current, [key]: route })
    setRecentFlights(current => {
      if (!current.some(item => normalizedFlight(item.aircraft.flight || '') === key)) return current
      const next = current.map(item => normalizedFlight(item.aircraft.flight || '') === key
        ? { ...item, aircraft: { ...item.aircraft, ownOp: meaningfulOperator(item.aircraft.ownOp) || route.airline?.name || item.aircraft.ownOp }, route }
        : item)
      persistRecentFlights(next)
      return next
    })
  }, [route, selected?.flight])

  const chooseFlight = useCallback((item: Aircraft, forceExternal = false) => {
    const key = normalizedFlight(item.flight || '')
    const knownRoute = routeIndex[key] || null
    const recentAircraft = { ...item, ownOp: meaningfulOperator(item.ownOp) || knownRoute?.airline?.name || item.ownOp }
    setRecentFlights(current => {
      const next = [
        { aircraft: recentAircraft, route: knownRoute, viewedAt: Date.now() },
        ...current.filter(entry => normalizedFlight(entry.aircraft.flight || '') !== key),
      ].slice(0, 6)
      persistRecentFlights(next)
      return next
    })
    if (item.adsbCallsign || forceExternal) setExternalAircraft(forceExternal && !item.adsbCallsign ? { ...item, adsbCallsign: item.flight } : item)
    setSelectedHex(item.hex)
    setTab('map')
    setMapFocusRequest(current => current + 1)
    setShowResults(false)
    setQuery('')
  }, [routeIndex])

  if (!selected) return <div className="boot-screen"><LogoMark/><span>{t('initializing')}</span></div>

  const departureTime = selected.scheduledDeparture ? new Date(selected.scheduledDeparture).getTime() : null
  const arrivalTime = selected.scheduledArrival ? new Date(selected.scheduledArrival).getTime() : null
  const flightStatus = selected.trackingState === 'live'
    ? t('inFlight')
    : departureTime !== null && clock < departureTime
      ? t('departsIn', { time: compactCountdown(departureTime - clock) })
      : selected.trackingState === 'landed' || (arrivalTime !== null && clock >= arrivalTime)
        ? t('landed')
        : selected.trackingState === 'scheduled'
          ? t('awaitingSignal')
          : null
  const flightStatusTone = flightStatus === t('landed') ? 'landed' : selected.trackingState || ''
  const pageIsLive = isLive || selected.trackingState === 'live'
  const sourceStatus = pageIsLive ? 'LIVE ADS-B' : loading ? t('connectingAdsb') : t('demoMode')

  const operatorName = meaningfulOperator(selected.ownOp) || route?.airline?.name || t('unknownOperator')
  const originCode = route?.origin.iata_code || route?.origin.icao_code || '—'
  const originDetail = route ? route.origin.municipality || route.origin.name || originCode : t('routeUnavailable')
  const destinationCode = route?.destination.iata_code || route?.destination.icao_code || '—'
  const distanceKm = remainingDistance === null ? '' : `${Math.round(remainingDistance * 1.852).toLocaleString(locale)} KM`
  const destinationDetail = route ? route.destination.municipality || route.destination.name || destinationCode : t('routeUnavailable')

  const tabs = [
    { id: 'map' as const, label: t('trafficMap'), icon: Map },
    { id: 'trajectory' as const, label: t('trajectory'), icon: Waypoints },
    { id: '3d' as const, label: t('view3d'), icon: Box },
  ]

  const renderSearchResult = ({ aircraft: item, route: itemRoute, recent, remote }: SearchResult) => {
    const company = meaningfulOperator(item.ownOp) || itemRoute?.airline?.name || clean(item.r)
    const originCity = itemRoute?.origin.municipality || itemRoute?.origin.name
    const originCode = itemRoute?.origin.iata_code || itemRoute?.origin.icao_code
    const destinationCity = itemRoute?.destination.municipality || itemRoute?.destination.name
    const destinationCode = itemRoute?.destination.iata_code || itemRoute?.destination.icao_code
    const origin = originCity ? `${originCity}${originCode ? ` (${originCode})` : ''}` : ''
    const destination = destinationCity ? `${destinationCity}${destinationCode ? ` (${destinationCode})` : ''}` : ''
    const routeSummary = origin && destination ? `${origin} → ${destination}` : origin || destination
    const description = [company, routeSummary, item.desc || item.t].filter(Boolean).join(' · ')
    return <button key={`${recent ? 'recent' : remote ? 'remote' : 'result'}-${item.hex}`} onClick={() => chooseFlight(item, Boolean(recent || remote))}>{recent ? <Clock3 className="recent-icon"/> : <PlaneGlyph/>}<span><strong>{clean(item.flight)}</strong><small>{description}</small></span><span className="result-alt">{item.trackingState === 'scheduled' ? t('scheduled') : feet(item.alt_baro, locale, t('ground'))}</span></button>
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label={t('home')}><LogoMark/><span>AERO<strong>SCOPE</strong></span></a>
      <div className="header-actions">
        <div className={`live-state ${pageIsLive ? '' : 'offline'}`} title={!pageIsLive ? t('sourceHelp') : undefined}><i/>{sourceStatus}</div>
        <button className="icon-btn" aria-label={t('notifications')}><Bell size={17}/><i/></button>
        <div className="avatar">FL</div>
      </div>
    </header>

    <main id="top">
      <section className="search-strip">
        <div className="search-field" ref={searchFieldRef}>
          <Search size={17}/>
          <input value={query} onFocus={() => setShowResults(true)} onChange={event => { setQuery(event.target.value); setShowResults(true) }} placeholder={t('searchPlaceholder')} aria-label={t('searchFlight')} />
          <kbd>⌘ K</kbd>
          {showResults && <div className="search-results">
            {recentResults.length > 0 && <><div className="results-caption recent-caption">{t('recentFlights')}</div>{recentResults.map(renderSearchResult)}</>}
            {airlineResults.length > 0 && <><div className="results-caption remote-caption">{t('airlineSearch')}</div>{airlineResults.slice(0, 1).map(airline => <div className="search-scope-card" key={airline.id}><Plane/><span><strong>{airline.name}</strong><small>{airline.description || `${t('icaoCode')} ${airline.icao}`}</small></span><span className="result-alt">{remoteSearching ? t('loading') : `${remoteAircraft.length} ${remoteAircraft.length === 1 ? t('flight') : t('flights')}`}</span></div>)}</>}
            {!airlineResults.length && placeResults.length > 0 && <><div className="results-caption remote-caption">{t('areaSearch')}</div>{placeResults.slice(0, 1).map(place => <div className="search-scope-card place-scope-card" key={place.id}><Map/><span><strong>{place.name}</strong><small>{place.detail}</small></span></div>)}</>}
            {results.length > 0 && <><div className="results-caption">{query ? `${results.length + recentResults.length} ${(results.length + recentResults.length) > 1 ? t('flights') : t('flight')} ${(results.length + recentResults.length) > 1 ? t('foundPlural') : t('found')}` : t('nearbyFlights')}</div>{results.map(renderSearchResult)}</>}
            {!results.length && !recentResults.length && !remoteSearching && !placeResults.length && !airlineResults.length && <p>{t('noAircraft')}</p>}
            {!results.length && !remoteSearching && (placeResults.length > 0 || airlineResults.length > 0) && <p>{t('noLiveScopeFlights')}</p>}
          </div>}
        </div>
        <div className={`region-select ${regionId === 'gps' ? 'gps-active' : ''}`} title={gpsError ? t('gpsUnavailable') : undefined}>{regionId === 'gps' ? <LocateFixed size={15}/> : <Map size={15}/>}<select value={regionId} onChange={event => chooseRegion(event.target.value)} aria-label={t('trafficArea')}><option value="gps">{gpsLoading ? t('locating') : gpsError ? t('gpsUnavailable') : t('regionGps')} · GPS</option>{searchRegion && <option value="search">{searchRegion.name} · {searchRegion.detail}</option>}{regions.map(item => <option key={item.id} value={item.id}>{t(`region${item.id === 'new-york' ? 'NewYork' : item.id[0].toUpperCase() + item.id.slice(1)}`)} · {item.detail}</option>)}</select><ChevronDown size={14}/></div>
        <div className="traffic-count"><Plane size={15}/><strong>{airborne}</strong> {t('airborne')}</div>
        <button className={`refresh-btn ${loading ? 'loading' : ''}`} onClick={() => void refresh()}><RefreshCw size={15}/><span>{t('refresh')}</span></button>
      </section>

      <section className="flight-banner">
        <div className="banner-accent" />
        <div className="flight-number"><span>{t('trackedFlight')}</span><h1>{clean(selected.flight)}</h1><small className="flight-airline">{operatorName}</small><small className="flight-registration">{clean(selected.r)} · {clean(selected.t)}</small>{flightStatus && <small className={`flight-status ${flightStatusTone}`}>{flightStatus}</small>}<small className="mobile-route-summary">{originCode} → {destinationCode}{distanceKm ? ` · ${distanceKm}` : ''}</small></div>
        <div className="route-visual">
          <div className="route-origin"><strong>{originCode}</strong><small>{originDetail}</small></div>
          <div className="route-line"><i/><b className="route-plane"><PlaneGlyph/>{distanceKm && <small className="route-distance">{distanceKm}</small>}</b><i/></div>
          <div className="route-end"><strong>{destinationCode}</strong><small>{destinationDetail}</small></div>
        </div>
        <div className="banner-stat"><span>{t('altitude')}</span><strong>{feet(selected.alt_baro, locale, t('ground'))}</strong><small>{selected.baro_rate ? `${selected.baro_rate > 0 ? '+' : ''}${selected.baro_rate.toLocaleString(locale)} ft/min` : t('stable')}</small></div>
        <div className="banner-stat"><span>{t('groundSpeed')}</span><strong>{knots(selected.gs)}</strong><small>{Math.round((selected.gs || 0) * 1.852).toLocaleString(locale)} km/h</small></div>
        <button className={`sound-button ${sound.playing ? 'playing' : ''}`} onClick={sound.toggle}>{sound.playing ? <Volume2 size={18}/> : <VolumeX size={18}/>}<span><strong>{sound.playing ? t('soundOn') : t('listen')}</strong><small>{t('engineAmbience')}</small></span></button>
      </section>

      <div className="workspace">
        <section className="main-column">
          <div className="tabs" role="tablist">{tabs.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={16}/>{item.label}</button>)}<div className="updated"><Clock3 size={13}/>{t('updated')} {lastUpdate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div></div>
          <div className="tab-content">
            {tab === 'map' && <LiveMap key={`${selected.hex}:${route?.callsign || 'pending'}`} aircraft={displayAircraft} selected={selected} region={region} route={route} focusRequest={mapFocusRequest} onSelect={chooseFlight}/>}
            {tab === 'trajectory' && <Trajectory aircraft={selected}/>} 
            {tab === '3d' && <Aircraft3D aircraft={selected}/>} 
          </div>
        </section>
        <FlightDetails aircraft={selected} statusLabel={flightStatus}/>
      </div>
    </main>

    <footer><div><LogoMark/>AEROSCOPE</div><span>{t('communityFooter')}</span><span><Headphones size={13}/> {t('soundExperience')}</span></footer>
  </div>
}
