import type { Aircraft, FlightRoute, Region } from '../types'

export type PlaceSearchResult = {
  id: string
  name: string
  detail: string
  kind: string
  region: Region
}

export type AirlineSearchResult = {
  id: string
  name: string
  description: string
  icao: string
}

export type FlightNumberSearchResult = {
  aircraft: Aircraft
  route: FlightRoute
}

export type RoutePlaceSearchResult = {
  origin: PlaceSearchResult
  destination: PlaceSearchResult
}

type NominatimPlace = {
  place_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  addresstype?: string
  category?: string
  boundingbox?: [string, string, string, string]
}

type WikidataSearch = { search?: Array<{ id: string }> }
type WikidataClaim = { mainsnak?: { datavalue?: { value?: unknown } } }
type WikidataEntity = {
  labels?: Record<string, { value: string }>
  descriptions?: Record<string, { value: string }>
  claims?: Record<string, WikidataClaim[]>
}

function flightNumberFromQuery(query: string) {
  const matches = [...query.toUpperCase().matchAll(/(?:^|\s)([A-Z0-9]{2,3})\s*[- ]?\s*0*(\d{1,4}[A-Z]?)(?=\s|$)/g)]
  const match = matches.at(-1)
  return match ? `${match[1]}${match[2]}` : ''
}

function callsignVariants(value?: string) {
  const callsign = value?.trim().toUpperCase()
  if (!callsign) return []
  const match = callsign.match(/^([A-Z]{2,3})(\d{1,4}[A-Z]?)$/)
  if (!match) return [callsign]
  const numeric = match[2].match(/^(\d+)([A-Z]?)$/)
  if (!numeric) return [callsign]
  return [...new Set([
    callsign,
    `${match[1]}${numeric[1].padStart(3, '0')}${numeric[2]}`,
  ])]
}

export async function searchFlightNumber(query: string, signal?: AbortSignal): Promise<FlightNumberSearchResult | null> {
  const requestedCallsign = flightNumberFromQuery(query)
  if (!requestedCallsign) return null

  const routeResponse = await fetch(`/api/route/${encodeURIComponent(requestedCallsign)}`, { signal })
  if (!routeResponse.ok) return null
  const payload = await routeResponse.json() as { response?: { flightroute?: FlightRoute } }
  const route = payload.response?.flightroute
  if (!route?.origin || !route.destination) return null

  const displayCallsign = route.callsign_iata?.trim() || route.callsign.trim() || requestedCallsign
  const adsbCallsign = route.callsign_icao?.trim() || route.callsign.trim() || requestedCallsign
  const aliases = [...new Set([
    requestedCallsign,
    ...callsignVariants(route.callsign_iata),
    ...callsignVariants(route.callsign_icao),
    ...callsignVariants(route.callsign),
  ].filter(Boolean))]
  let liveAircraft: Aircraft | undefined

  for (const callsign of callsignVariants(adsbCallsign)) {
    try {
      const response = await fetch(`/api/aircraft/callsign/${encodeURIComponent(callsign)}`, { signal })
      if (!response.ok) continue
      const aircraft = (await response.json() as { ac?: Aircraft[] }).ac
      liveAircraft = aircraft?.find(item => typeof item.lat === 'number' && typeof item.lon === 'number')
      if (liveAircraft) break
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }

  return {
    route,
    aircraft: {
      ...liveAircraft,
      hex: liveAircraft?.hex || `scheduled-${displayCallsign.toLowerCase()}`,
      flight: displayCallsign,
      ownOp: route.airline?.name || liveAircraft?.ownOp,
      trackingState: liveAircraft ? 'live' : 'scheduled',
      adsbCallsign,
      aliases,
    },
  }
}

export async function searchPlaces(query: string, language: string, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '3', addressdetails: '1', 'accept-language': language })
  const response = await fetch(`/api/geocode?${params}`, { signal })
  if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`)
  const places = await response.json() as NominatimPlace[]
  const placeRank = (place: NominatimPlace) => {
    if (place.category === 'aeroway') return 0
    return ({ city: 1, town: 2, municipality: 2, village: 3, state: 4, country: 5 } as Record<string, number>)[place.addresstype || ''] ?? 6
  }
  const searchableKinds = new Set(['aerodrome', 'airport', 'city', 'town', 'municipality', 'village', 'state', 'country', 'county', 'administrative'])
  return [...places]
    .filter(place => place.category === 'aeroway' || searchableKinds.has(place.addresstype || ''))
    .sort((left, right) => placeRank(left) - placeRank(right)).map(place => {
    const lat = Number(place.lat)
    const lon = Number(place.lon)
    const bounds = place.boundingbox?.map(Number)
    const latitudeSpan = bounds ? Math.abs(bounds[1] - bounds[0]) : 0
    const longitudeSpan = bounds ? Math.abs(bounds[3] - bounds[2]) * Math.max(Math.cos(lat * Math.PI / 180), 0.25) : 0
    const radius = Math.min(250, Math.max(60, Math.ceil(Math.max(latitudeSpan, longitudeSpan) * 30 * 1.25)))
    const name = place.name || place.display_name.split(',')[0]
    return {
      id: String(place.place_id),
      name,
      detail: place.display_name,
      kind: place.addresstype || place.category || 'place',
      region: { id: `search-${place.place_id}`, name, detail: `${radius} NM`, lat, lon, radius, zoom: radius > 180 ? 4.8 : radius > 100 ? 5.4 : 6.2 },
    }
  }).filter(place => Number.isFinite(place.region.lat) && Number.isFinite(place.region.lon))
}

export function splitRouteQuery(query: string) {
  const explicit = query.split(/\s*(?:→|->|>|\/|\b(?:to|vers)\b)\s*/i).map(value => value.trim()).filter(Boolean)
  if (explicit.length === 2) return { origin: explicit[0], destination: explicit[1] }
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  return { origin: words.slice(0, -1).join(' '), destination: words.at(-1)! }
}

export async function searchRoutePlaces(query: string, language: string, signal?: AbortSignal): Promise<RoutePlaceSearchResult | null> {
  const pair = splitRouteQuery(query)
  if (!pair) return null
  const [origins, destinations] = await Promise.all([
    searchPlaces(pair.origin, language, signal),
    searchPlaces(pair.destination, language, signal),
  ])
  return origins[0] && destinations[0] ? { origin: origins[0], destination: destinations[0] } : null
}

export async function searchAirlines(query: string, language: string, signal?: AbortSignal): Promise<AirlineSearchResult[]> {
  const searches = await Promise.all([query, `${query} air`, `${query} airline`].map(async search => {
    const searchParams = new URLSearchParams({ action: 'wbsearchentities', search, language, uselang: language, format: 'json', origin: '*', limit: '8' })
    const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams}`, { signal })
    if (!searchResponse.ok) throw new Error(`Wikidata HTTP ${searchResponse.status}`)
    return searchResponse.json() as Promise<WikidataSearch>
  }))
  const ids = [...new Set(searches.flatMap(search => (search.search || []).map(item => item.id)))]
  if (!ids.length) return []
  const entityParams = new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|descriptions', languages: `${language}|en`, format: 'json', origin: '*' })
  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams}`, { signal })
  if (!entityResponse.ok) throw new Error(`Wikidata HTTP ${entityResponse.status}`)
  const payload = await entityResponse.json() as { entities?: Record<string, WikidataEntity> }
  return Object.entries(payload.entities || {}).flatMap(([id, entity]) => {
    const icao = entity.claims?.P230?.[0]?.mainsnak?.datavalue?.value
    if (typeof icao !== 'string' || !icao.trim()) return []
    const name = entity.labels?.[language]?.value || entity.labels?.en?.value
    if (!name) return []
    return [{ id, name, description: entity.descriptions?.[language]?.value || entity.descriptions?.en?.value || '', icao: icao.trim().toUpperCase() }]
  }).slice(0, 3)
}
