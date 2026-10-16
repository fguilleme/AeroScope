import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Box, ChevronDown, Clock3, Headphones, LocateFixed, Map, Plane, RefreshCw, Search, Volume2, VolumeX, Waypoints } from 'lucide-react'
import { aircraftName, airlineFromCallsign, regions, watchedFlights } from './data'
import { useFlightData } from './hooks/useFlightData'
import { useEngineSound } from './hooks/useEngineSound'
import type { Aircraft, Region } from './types'
import { clean, distanceNm, feet, knots } from './utils'
import Aircraft3D from './components/Aircraft3D'
import FlightDetails from './components/FlightDetails'
import LiveMap from './components/LiveMap'
import { LogoMark, PlaneGlyph } from './components/Icons'
import Trajectory from './components/Trajectory'
import { useI18n } from './i18n'
import { useFlightRoute } from './hooks/useFlightRoute'

type Tab = 'map' | 'trajectory' | '3d'

function compactCountdown(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}H${minutes.toString().padStart(2, '0')}`
}

function normalizedFlight(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]{2,3})0+(\d)/, '$1$2')
}

export default function App() {
  const { locale, t } = useI18n()
  const [regionId, setRegionId] = useState('paris')
  const [gpsRegion, setGpsRegion] = useState<Region | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(false)
  const region = regionId === 'gps' && gpsRegion ? gpsRegion : regions.find(item => item.id === regionId) || regions[0]
  const { aircraft, loading, isLive, lastUpdate, refresh, airborne } = useFlightData(region)
  const [selectedHex, setSelectedHex] = useState('')
  const [tab, setTab] = useState<Tab>('map')
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [externalAircraft, setExternalAircraft] = useState<Aircraft | null>(null)
  const [clock, setClock] = useState(Date.now())
  const [mapFocusRequest, setMapFocusRequest] = useState(0)

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
  const results = useMemo(() => {
    const needle = normalizedFlight(query)
    if (!needle) return displayAircraft.slice(0, 8)
    const local = displayAircraft.filter(item => [item.flight, item.r, item.t, item.ownOp].some(value => normalizedFlight(value || '').includes(needle)))
    const scheduled = watchedFlights.filter(item => item.aliases?.some(alias => normalizedFlight(alias) === needle))
    return [...local, ...scheduled].filter((item, index, list) => list.findIndex(candidate => candidate.hex === item.hex) === index).slice(0, 12)
  }, [displayAircraft, query])

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

  const chooseFlight = useCallback((item: Aircraft) => {
    if (item.adsbCallsign) setExternalAircraft(item)
    setSelectedHex(item.hex)
    setTab('map')
    setMapFocusRequest(current => current + 1)
    setShowResults(false)
    setQuery('')
  }, [])

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

  const operatorName = !selected.ownOp || selected.ownOp === 'Opérateur non identifié' ? t('unknownOperator') : selected.ownOp
  const originCode = route?.origin.iata_code || route?.origin.icao_code || '—'
  const originDetail = route ? route.origin.municipality || route.origin.name || originCode : t('routeUnavailable')
  const destinationCode = route?.destination.iata_code || route?.destination.icao_code || '—'
  const distanceLabel = remainingDistance === null ? '' : `${Math.round(remainingDistance).toLocaleString(locale)} NM`
  const destinationSummary = [destinationCode, distanceLabel].filter(Boolean).join(' · ')
  const destinationDetail = route ? route.destination.municipality || route.destination.name || destinationCode : t('routeUnavailable')

  const tabs = [
    { id: 'map' as const, label: t('trafficMap'), icon: Map },
    { id: 'trajectory' as const, label: t('trajectory'), icon: Waypoints },
    { id: '3d' as const, label: t('view3d'), icon: Box },
  ]

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
        <div className="search-field">
          <Search size={17}/>
          <input value={query} onFocus={() => setShowResults(true)} onChange={event => { setQuery(event.target.value); setShowResults(true) }} placeholder={t('searchPlaceholder')} aria-label={t('searchFlight')} />
          <kbd>⌘ K</kbd>
          {showResults && <div className="search-results">
            <div className="results-caption">{results.length} {results.length > 1 ? t('flights') : t('flight')} {results.length > 1 ? t('foundPlural') : t('found')}</div>
            {results.map(item => <button key={item.hex} onClick={() => chooseFlight(item)}><PlaneGlyph/><span><strong>{clean(item.flight)}</strong><small>{item.ownOp || clean(item.r)} · {item.desc || item.t}</small></span><span className="result-alt">{item.trackingState === 'scheduled' ? t('scheduled') : feet(item.alt_baro, locale, t('ground'))}</span></button>)}
            {!results.length && <p>{t('noAircraft')}</p>}
          </div>}
        </div>
        <div className={`region-select ${regionId === 'gps' ? 'gps-active' : ''}`} title={gpsError ? t('gpsUnavailable') : undefined}>{regionId === 'gps' ? <LocateFixed size={15}/> : <Map size={15}/>}<select value={regionId} onChange={event => chooseRegion(event.target.value)} aria-label={t('trafficArea')}><option value="gps">{gpsLoading ? t('locating') : gpsError ? t('gpsUnavailable') : t('regionGps')} · GPS</option>{regions.map(item => <option key={item.id} value={item.id}>{t(`region${item.id === 'new-york' ? 'NewYork' : item.id[0].toUpperCase() + item.id.slice(1)}`)} · {item.detail}</option>)}</select><ChevronDown size={14}/></div>
        <div className="traffic-count"><Plane size={15}/><strong>{airborne}</strong> {t('airborne')}</div>
        <button className={`refresh-btn ${loading ? 'loading' : ''}`} onClick={() => void refresh()}><RefreshCw size={15}/><span>{t('refresh')}</span></button>
      </section>

      <section className="flight-banner">
        <div className="banner-accent" />
        <div className="flight-number"><span>{t('trackedFlight')}</span><h1>{clean(selected.flight)}</h1><small className="flight-airline">{operatorName}</small><small className="flight-registration">{clean(selected.r)} · {clean(selected.t)}</small>{flightStatus && <small className={`flight-status ${flightStatusTone}`}>{flightStatus}</small>}<small className="mobile-route-summary">{originCode} → {destinationCode}{remainingDistance === null ? '' : ` · ${Math.round(remainingDistance).toLocaleString(locale)} NM`}</small></div>
        <div className="route-visual">
          <div className="route-origin"><span>{t('departure')}</span><strong>{originCode}</strong><small>{originDetail}</small></div>
          <div className="route-line"><i/><b className="route-plane"><PlaneGlyph/></b><i/></div>
          <div className="route-end"><span>{t('destination')}</span><strong>{destinationSummary}</strong><small>{destinationDetail}</small></div>
        </div>
        <div className="banner-stat"><span>{t('altitude')}</span><strong>{feet(selected.alt_baro, locale, t('ground'))}</strong><small>{selected.baro_rate ? `${selected.baro_rate > 0 ? '+' : ''}${selected.baro_rate.toLocaleString(locale)} ft/min` : t('stable')}</small></div>
        <div className="banner-stat"><span>{t('groundSpeed')}</span><strong>{knots(selected.gs)}</strong><small>{Math.round((selected.gs || 0) * 1.852).toLocaleString(locale)} km/h</small></div>
        <button className={`sound-button ${sound.playing ? 'playing' : ''}`} onClick={sound.toggle}>{sound.playing ? <Volume2 size={18}/> : <VolumeX size={18}/>}<span><strong>{sound.playing ? t('soundOn') : t('listen')}</strong><small>{t('engineAmbience')}</small></span></button>
      </section>

      <div className="workspace">
        <section className="main-column">
          <div className="tabs" role="tablist">{tabs.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={16}/>{item.label}</button>)}<div className="updated"><Clock3 size={13}/>{t('updated')} {lastUpdate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div></div>
          <div className="tab-content">
            {tab === 'map' && <LiveMap aircraft={displayAircraft} selected={selected} region={region} route={route} focusRequest={mapFocusRequest} onSelect={chooseFlight}/>} 
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
