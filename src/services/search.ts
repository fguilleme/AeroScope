import type { Region } from '../types'

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

export async function searchPlaces(query: string, language: string, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '3', addressdetails: '1', 'accept-language': language })
  const response = await fetch(`/api/geocode?${params}`, { signal })
  if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`)
  const places = await response.json() as NominatimPlace[]
  const placeRank = (place: NominatimPlace) => {
    if (place.category === 'aeroway') return 0
    return ({ city: 1, town: 2, municipality: 2, village: 3, state: 4, country: 5 } as Record<string, number>)[place.addresstype || ''] ?? 6
  }
  return [...places].sort((left, right) => placeRank(left) - placeRank(right)).map(place => {
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
