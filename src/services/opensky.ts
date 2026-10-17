import { aircraftName, airlineFromCallsign } from '../data'
import type { Aircraft, Region } from '../types'

type OpenSkyPayload = {
  states?: Array<Array<string | number | boolean | null>>
}

function aircraftFromPayload(payload: OpenSkyPayload) {
  return (payload.states || []).flatMap(state => {
    const hex = typeof state[0] === 'string' ? state[0] : ''
    const flight = typeof state[1] === 'string' ? state[1].trim() : ''
    const lon = typeof state[5] === 'number' ? state[5] : null
    const lat = typeof state[6] === 'number' ? state[6] : null
    if (!hex || !flight || lon === null || lat === null) return []
    const onGround = state[8] === true
    const altitudeMeters = typeof state[7] === 'number' ? state[7] : null
    const speedMetersPerSecond = typeof state[9] === 'number' ? state[9] : null
    const verticalMetersPerSecond = typeof state[11] === 'number' ? state[11] : null
    const type = ''
    return [{
      hex,
      flight,
      t: type,
      desc: aircraftName(type),
      ownOp: airlineFromCallsign(flight),
      alt_baro: onGround ? 'ground' as const : altitudeMeters === null ? undefined : Math.round(altitudeMeters * 3.28084),
      gs: speedMetersPerSecond === null ? undefined : speedMetersPerSecond * 1.94384,
      track: typeof state[10] === 'number' ? state[10] : undefined,
      baro_rate: verticalMetersPerSecond === null ? undefined : Math.round(verticalMetersPerSecond * 196.85),
      lat,
      lon,
      squawk: typeof state[14] === 'string' ? state[14] : undefined,
      seen: 0,
      trackingState: 'live' as const,
    } satisfies Aircraft]
  })
}

export async function fetchOpenSkyAircraft(region: Region, signal?: AbortSignal) {
  const latitudeRadius = region.radius / 60
  const longitudeRadius = latitudeRadius / Math.max(Math.cos(region.lat * Math.PI / 180), 0.25)
  const query = new URLSearchParams({
    lamin: (region.lat - latitudeRadius).toFixed(4),
    lomin: (region.lon - longitudeRadius).toFixed(4),
    lamax: (region.lat + latitudeRadius).toFixed(4),
    lomax: (region.lon + longitudeRadius).toFixed(4),
  })
  const response = await fetch(`/api/opensky?${query}`, { signal })
  if (!response.ok) throw new Error(`OpenSky HTTP ${response.status}`)
  const payload = await response.json() as OpenSkyPayload

  return aircraftFromPayload(payload)
}

export async function fetchOpenSkyGlobal(signal?: AbortSignal, icao24?: string) {
  const query = icao24 ? `?icao24=${encodeURIComponent(icao24)}` : ''
  const response = await fetch(`/api/opensky${query}`, { signal })
  if (!response.ok) throw new Error(`OpenSky HTTP ${response.status}`)
  return aircraftFromPayload(await response.json() as OpenSkyPayload)
}
