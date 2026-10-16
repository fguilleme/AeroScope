import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import { Layers3, LocateFixed, Minus, Plus } from 'lucide-react'
import type { Aircraft, FlightRoute, Region } from '../types'
import { clean, compactDuration, estimatedTrail, feet, flightDurations, greatCirclePoints, knots, routeAlignedTrail } from '../utils'
import { PlaneGlyph } from './Icons'
import { useI18n } from '../i18n'

type Props = {
  aircraft: Aircraft[]
  selected: Aircraft
  region: Region
  route: FlightRoute | null
  focusRequest: number
  onSelect: (aircraft: Aircraft) => void
}

const styles = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
}

function projectedHeading(map: MapLibreMap, item: Aircraft) {
  const heading = item.track || 0
  if (typeof item.lon !== 'number' || typeof item.lat !== 'number') return heading

  const radians = heading * Math.PI / 180
  const latitudeStep = Math.cos(radians) * 0.08
  const longitudeStep = Math.sin(radians) * 0.08 / Math.max(Math.cos(item.lat * Math.PI / 180), 0.25)
  const current = map.project([item.lon, item.lat])
  const ahead = map.project([item.lon + longitudeStep, item.lat + latitudeStep])
  return Math.atan2(ahead.y - current.y, ahead.x - current.x) * 180 / Math.PI + 90
}

function declutterAircraftMarkers(map: MapLibreMap, markers: Array<{ element: HTMLElement; aircraft: Aircraft }>, selectedHex: string) {
  const zoom = map.getZoom()
  const minimumSpacing = zoom < 5.5 ? 64 : zoom < 6.5 ? 50 : zoom < 7.5 ? 38 : 25
  const canvas = map.getCanvas()
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const placed: Array<{ x: number; y: number }> = []
  const ordered = [...markers].sort((left, right) => Number(right.aircraft.hex === selectedHex) - Number(left.aircraft.hex === selectedHex))

  ordered.forEach(({ element, aircraft: item }) => {
    if (typeof item.lon !== 'number' || typeof item.lat !== 'number') {
      element.classList.add('decluttered')
      return
    }
    const point = map.project([item.lon, item.lat])
    const onScreen = point.x > -25 && point.x < width + 25 && point.y > -25 && point.y < height + 25
    const isSelected = item.hex === selectedHex
    const collides = !isSelected && placed.some(visible => Math.hypot(point.x - visible.x, point.y - visible.y) < minimumSpacing)
    const visible = onScreen && !collides
    element.classList.toggle('decluttered', !visible)
    if (visible) placed.push({ x: point.x, y: point.y })
  })
}

function useLocalMapNames(map: MapLibreMap) {
  map.getStyle().layers?.forEach(layer => {
    if (layer.type !== 'symbol') return
    const textField = layer.layout?.['text-field']
    if (!textField || !JSON.stringify(textField).includes('name_en')) return
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name'], ['get', 'name_en']])
  })
}

export default function LiveMap({ aircraft, selected, region, route, focusRequest, onSelect }: Props) {
  const { locale, t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const markerAircraftRef = useRef<Array<{ element: HTMLElement; aircraft: Aircraft }>>([])
  const routeMarkersRef = useRef<Marker[]>([])
  const userMarkerRef = useRef<Marker | null>(null)
  const [base, setBase] = useState<keyof typeof styles>('dark')
  const durations = useMemo(() => route ? flightDurations(route.origin, route.destination, selected) : null, [route, selected])
  const durationText = durations ? `${t('totalShort')} ${compactDuration(durations.total)} · ${t('remainingShort')} ${compactDuration(durations.remaining)}` : ''
  const selectedTrail = useMemo(() => selected.trackingState === 'scheduled'
    ? []
    : route
      ? routeAlignedTrail(route.origin, route.destination, selected)
      : estimatedTrail(selected), [route, selected])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styles[base],
      center: [region.lon, region.lat],
      zoom: region.zoom,
      attributionControl: false,
      pitch: 35,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load', () => {
      useLocalMapNames(map)
      map.addSource('flight-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route ? greatCirclePoints(route.origin, route.destination) : [] } } })
      map.addLayer({ id: 'flight-route-glow', type: 'line', source: 'flight-route', paint: { 'line-color': '#71c4ed', 'line-width': 7, 'line-opacity': 0.09, 'line-blur': 5 } })
      map.addLayer({ id: 'flight-route', type: 'line', source: 'flight-route', paint: { 'line-color': '#71c4ed', 'line-width': 1.4, 'line-opacity': 0.68, 'line-dasharray': [1.2, 1.8] } })
      map.addSource('selected-trail', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: selectedTrail } } })
      map.addLayer({ id: 'selected-trail-glow', type: 'line', source: 'selected-trail', paint: { 'line-color': '#caff55', 'line-width': 8, 'line-opacity': 0.12, 'line-blur': 6 } })
      map.addLayer({ id: 'selected-trail', type: 'line', source: 'selected-trail', paint: { 'line-color': '#caff55', 'line-width': 2.2, 'line-opacity': 0.85, 'line-dasharray': [0.3, 1.5] } })
    })
    mapRef.current = map
    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markerAircraftRef.current = []
      routeMarkersRef.current.forEach(marker => marker.remove())
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [base, region])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    userMarkerRef.current?.remove()
    userMarkerRef.current = null
    if (region.id !== 'gps') return

    const element = document.createElement('div')
    element.className = 'user-location-marker'
    element.setAttribute('aria-label', t('regionGps'))
    userMarkerRef.current = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat([region.lon, region.lat])
      .addTo(map)
    return () => {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
    }
  }, [region, base, t])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    const update = () => {
      if (cancelled || mapRef.current !== map) return
      const source = map.getSource('selected-trail') as maplibregl.GeoJSONSource | undefined
      source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: selectedTrail } })
    }
    map.isStyleLoaded() ? update() : map.once('load', update)
    return () => {
      cancelled = true
      map.off('load', update)
    }
  }, [selectedTrail])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    const update = () => {
      if (cancelled || mapRef.current !== map) return
      const source = map.getSource('flight-route') as maplibregl.GeoJSONSource | undefined
      const coordinates = route ? greatCirclePoints(route.origin, route.destination) : []
      source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })
    }
    map.isStyleLoaded() ? update() : map.once('load', update)
    return () => {
      cancelled = true
      map.off('load', update)
    }
  }, [route, selected.lat, selected.lon, base])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    routeMarkersRef.current.forEach(marker => marker.remove())
    routeMarkersRef.current = []
    if (!route) return
    let cancelled = false

    const addAirportMarker = (kind: 'origin' | 'destination') => {
      const airport = kind === 'origin' ? route.origin : route.destination
      const otherAirport = kind === 'origin' ? route.destination : route.origin
      const element = document.createElement('div')
      element.className = `route-airport-marker ${kind}`
      if (airport.longitude > otherAirport.longitude) element.classList.add('label-left')
      const dot = document.createElement('i')
      const copy = document.createElement('span')
      const title = document.createElement('strong')
      const city = document.createElement('small')
      title.textContent = `${kind === 'origin' ? t('departure') : t('arrival')} · ${airport.iata_code || airport.icao_code || '—'}`
      city.textContent = airport.municipality || airport.name || ''
      copy.append(title, city)
      element.append(dot, copy)

      const popupNode = document.createElement('div')
      const popupTitle = document.createElement('strong')
      const popupDetails = document.createElement('small')
      popupTitle.textContent = airport.name || airport.municipality || airport.iata_code || airport.icao_code || '—'
      popupDetails.textContent = `${airport.iata_code || '—'} · ${airport.icao_code || '—'} · ${airport.country_name || ''}`
      popupNode.append(popupTitle, popupDetails)
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(popupNode)
      return new maplibregl.Marker({ element, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([airport.longitude, airport.latitude]).setPopup(popup).addTo(map)
    }

    const install = () => {
      if (cancelled || mapRef.current !== map) return
      routeMarkersRef.current = [addAirportMarker('origin'), addAirportMarker('destination')]
      const bounds = new maplibregl.LngLatBounds()
        .extend([route.origin.longitude, route.origin.latitude])
        .extend([route.destination.longitude, route.destination.latitude])
      if (typeof selected.lon === 'number' && typeof selected.lat === 'number') bounds.extend([selected.lon, selected.lat])
      const compact = (containerRef.current?.clientWidth || 0) < 640
      map.stop()
      map.resize()
      map.fitBounds(bounds, { padding: compact ? { top: 80, right: 42, bottom: 150, left: 42 } : { top: 70, right: 90, bottom: 110, left: 90 }, maxZoom: 7.2, duration: 1000 })
    }
    install()
    return () => {
      cancelled = true
      routeMarkersRef.current.forEach(marker => marker.remove())
      routeMarkersRef.current = []
    }
  }, [route, base, region.id, selected.hex, focusRequest, t])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(marker => marker.remove())
    const markerAircraft: Array<{ element: HTMLElement; aircraft: Aircraft }> = []
    markersRef.current = aircraft.filter(item => item.trackingState !== 'scheduled' && item.trackingState !== 'landed').slice(0, 180).map(item => {
      const isSelected = item.hex === selected.hex
      const el = document.createElement('button')
      el.className = `aircraft-marker${isSelected ? ' selected' : ''}`
      el.setAttribute('aria-label', `${t('selectFlight')} ${clean(item.flight)}`)
      el.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 16.1v-2l-8.5-5V3.6A1.6 1.6 0 0 0 12 2a1.6 1.6 0 0 0-1.5 1.6v5.5l-8.5 5v2l8.5-2.7V19l-2.2 1.5V22l3.7-1 3.7 1v-1.5L13.5 19v-5.6l8.5 2.7Z"/></svg>'
      if (isSelected) {
        const flightLabel = document.createElement('span')
        flightLabel.className = 'marker-callsign'
        flightLabel.textContent = clean(item.flight)
        el.append(flightLabel)
        if (durationText) {
          const durationLabel = document.createElement('small')
          durationLabel.className = 'marker-duration'
          durationLabel.textContent = durationText
          el.append(durationLabel)
        }
      }
      el.style.setProperty('--heading', `${projectedHeading(map, item)}deg`)
      markerAircraft.push({ element: el, aircraft: item })
      el.onclick = () => onSelect(item)
      const popupNode = document.createElement('div')
      const popupTitle = document.createElement('strong')
      const popupDetails = document.createElement('small')
      popupTitle.textContent = clean(item.flight)
      popupDetails.textContent = `${clean(item.r)} · ${feet(item.alt_baro, locale, t('ground'))} · ${knots(item.gs)}`
      popupNode.append(popupTitle, popupDetails)
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(popupNode)
      return new maplibregl.Marker({ element: el, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([item.lon!, item.lat!]).setPopup(popup).addTo(map)
    })
    markerAircraftRef.current = markerAircraft
    declutterAircraftMarkers(map, markerAircraft, selected.hex)
  }, [aircraft, selected.hex, onSelect, locale, t, durationText, base])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const updateMarkers = () => {
      markerAircraftRef.current.forEach(({ element, aircraft: item }) => {
        element.style.setProperty('--heading', `${projectedHeading(map, item)}deg`)
      })
      declutterAircraftMarkers(map, markerAircraftRef.current, selected.hex)
    }
    updateMarkers()
    map.on('move', updateMarkers)
    map.on('resize', updateMarkers)
    return () => {
      map.off('move', updateMarkers)
      map.off('resize', updateMarkers)
    }
  }, [base, region, selected.hex])

  const centerSelected = () => mapRef.current?.easeTo({ center: [selected.lon!, selected.lat!], zoom: 8.4, pitch: 42, duration: 900 })

  return <div className="map-wrap">
    <div ref={containerRef} className="map-canvas" />
    <div className="map-fade" />
    <div className="map-legend"><span><i className="legend-selected" />{t('selectedFlight')}</span><span><i />{t('otherFlights')}</span><span><i className="legend-route" />{t('plannedRoute')}</span><span><i className="legend-trail" />{t('estimatedMapTrail')}</span></div>
    <div className="map-tools vertical">
      <button aria-label={t('zoomIn')} onClick={() => mapRef.current?.zoomIn()}><Plus size={16} /></button>
      <button aria-label={t('zoomOut')} onClick={() => mapRef.current?.zoomOut()}><Minus size={16} /></button>
      <button aria-label={t('centerFlight')} onClick={centerSelected}><LocateFixed size={16} /></button>
    </div>
    <button className="map-style" onClick={() => setBase(current => current === 'dark' ? 'light' : 'dark')}><Layers3 size={15} />{base === 'dark' ? t('lightMap') : t('darkMap')}</button>
    <div className="selected-map-card">
      <div className="map-plane" style={{ '--heading': `${selected.track || 0}deg` } as CSSProperties}><PlaneGlyph /></div>
      <div><span>{t('selectedFlightCaps')}</span><strong>{clean(selected.flight)}</strong><small>{clean(selected.r)} · {clean(selected.t)}</small>{route && <small className="route-card-meta">{route.origin.iata_code || route.origin.icao_code} → {route.destination.iata_code || route.destination.icao_code} · {durationText}</small>}</div>
      <div className="map-card-metric"><span>{t('altitude')}</span><b>{feet(selected.alt_baro, locale, t('ground'))}</b></div>
      <div className="map-card-metric"><span>{t('speed')}</span><b>{knots(selected.gs)}</b></div>
    </div>
  </div>
}
