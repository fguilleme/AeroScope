import type { Aircraft, Airport, FlightPhase } from './types'

export const clean = (value?: string) => value?.trim() || '—'
export const feet = (value?: number | 'ground', locale = 'fr-FR', ground = 'SOL') => value === 'ground' ? ground : typeof value === 'number' ? `${Math.round(value).toLocaleString(locale)} ft` : '—'
export const knots = (value?: number) => typeof value === 'number' ? `${Math.round(value)} kt` : '—'
export const kmh = (value?: number) => typeof value === 'number' ? `${Math.round(value * 1.852)} km/h` : '—'
export const meters = (value?: number | 'ground') => value === 'ground' ? 0 : typeof value === 'number' ? Math.round(value * 0.3048) : 0
export const heading = (value?: number) => typeof value === 'number' ? `${Math.round(value).toString().padStart(3, '0')}°` : '—'

export function phaseOf(aircraft: Aircraft): FlightPhase {
  if (aircraft.alt_baro === 'ground') return 'ground'
  const rate = aircraft.baro_rate || 0
  if (rate > 320) return 'climb'
  if (rate < -320) return 'descent'
  return 'cruise'
}

export function phaseKey(phase: FlightPhase) {
  return ({ cruise: 'phaseCruise', climb: 'phaseClimb', descent: 'phaseDescent', ground: 'phaseGround' } as const)[phase]
}

export function estimatedTrail(aircraft: Aircraft) {
  const lat = aircraft.lat || 0
  const lon = aircraft.lon || 0
  const heading = (aircraft.track || 0) * Math.PI / 180
  const eastward = Math.sin(heading)
  const northward = Math.cos(heading)
  const speed = Math.max(aircraft.gs || 250, 80)
  return Array.from({ length: 9 }, (_, i) => {
    const backMinutes = 24 - i * 3
    const distanceDeg = speed * (backMinutes / 60) / 60
    return [
      lon - eastward * distanceDeg / Math.max(Math.cos(lat * Math.PI / 180), 0.25),
      lat - northward * distanceDeg,
    ] as [number, number]
  }).concat([[lon, lat]])
}

export function routeAlignedTrail(origin: Airport, destination: Airport, aircraft: Aircraft) {
  if (typeof aircraft.lat !== 'number' || typeof aircraft.lon !== 'number') return estimatedTrail(aircraft)

  const routePoints = greatCirclePoints(origin, destination, 160)
  const aircraftPosition = { latitude: aircraft.lat, longitude: aircraft.lon }
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  routePoints.forEach(([longitude, latitude], index) => {
    const distance = distanceNm(aircraftPosition, { latitude, longitude })
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })

  const recentDistanceNm = Math.max(aircraft.gs || 250, 80) * (24 / 60)
  let startIndex = closestIndex
  let coveredDistance = 0
  while (startIndex > 0 && coveredDistance < recentDistanceNm) {
    const [fromLongitude, fromLatitude] = routePoints[startIndex - 1]
    const [toLongitude, toLatitude] = routePoints[startIndex]
    coveredDistance += distanceNm(
      { latitude: fromLatitude, longitude: fromLongitude },
      { latitude: toLatitude, longitude: toLongitude },
    )
    startIndex -= 1
  }

  const trail = routePoints.slice(startIndex, closestIndex + 1)
  return trail.length > 1 ? trail : [routePoints[closestIndex], routePoints[closestIndex]]
}

export function distanceNm(from: Pick<Airport, 'latitude' | 'longitude'>, to: Pick<Airport, 'latitude' | 'longitude'>) {
  const radiusNm = 3440.065
  const lat1 = from.latitude * Math.PI / 180
  const lat2 = to.latitude * Math.PI / 180
  const deltaLat = (to.latitude - from.latitude) * Math.PI / 180
  const deltaLon = (to.longitude - from.longitude) * Math.PI / 180
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  return radiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function greatCirclePoints(from: Pick<Airport, 'latitude' | 'longitude'>, to: Pick<Airport, 'latitude' | 'longitude'>, segments = 64) {
  const lat1 = from.latitude * Math.PI / 180
  const lon1 = from.longitude * Math.PI / 180
  const lat2 = to.latitude * Math.PI / 180
  const lon2 = to.longitude * Math.PI / 180
  const angularDistance = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ))
  if (angularDistance < 1e-8) return [[from.longitude, from.latitude], [to.longitude, to.latitude]] as [number, number][]

  const sinDistance = Math.sin(angularDistance)
  return Array.from({ length: segments + 1 }, (_, index) => {
    const fraction = index / segments
    const startWeight = Math.sin((1 - fraction) * angularDistance) / sinDistance
    const endWeight = Math.sin(fraction * angularDistance) / sinDistance
    const x = startWeight * Math.cos(lat1) * Math.cos(lon1) + endWeight * Math.cos(lat2) * Math.cos(lon2)
    const y = startWeight * Math.cos(lat1) * Math.sin(lon1) + endWeight * Math.cos(lat2) * Math.sin(lon2)
    const z = startWeight * Math.sin(lat1) + endWeight * Math.sin(lat2)
    return [Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI] as [number, number]
  })
}

export function flightDurations(origin: Airport, destination: Airport, aircraft: Aircraft) {
  const type = aircraft.t?.trim().toUpperCase() || ''
  const cruiseSpeed = /^(C1(50|52|72|77|82)|C2(06|08|10)|PA|SR2|BE|P28)/.test(type) ? 120
    : /^(AT|DH8|DHC)/.test(type) ? 270
      : /^(AS|B06|B407|EC|H(500|60|65)|R(22|44|66)|S(76|92))/.test(type) ? 135
        : /^(E1|E2|CRJ|BCS|F70|F100)/.test(type) ? 420
          : /^(A3[3-8]|B7(4|6|7|8))/.test(type) ? 480
            : 450
  const estimatedTotal = distanceNm(origin, destination) / cruiseSpeed + 0.35
  const scheduledDeparture = aircraft.scheduledDeparture ? Date.parse(aircraft.scheduledDeparture) : Number.NaN
  const scheduledArrival = aircraft.scheduledArrival ? Date.parse(aircraft.scheduledArrival) : Number.NaN
  const hasValidSchedule = Number.isFinite(scheduledDeparture) && Number.isFinite(scheduledArrival) && scheduledArrival > scheduledDeparture
  const total = hasValidSchedule ? (scheduledArrival - scheduledDeparture) / 3_600_000 : estimatedTotal
  const positionEstimate = typeof aircraft.lat === 'number' && Number.isFinite(aircraft.lat) && typeof aircraft.lon === 'number' && Number.isFinite(aircraft.lon)
    ? distanceNm({ latitude: aircraft.lat, longitude: aircraft.lon }, destination) / cruiseSpeed + 0.12
    : total
  const scheduleEstimate = hasValidSchedule
    ? Date.now() < scheduledDeparture ? total : (scheduledArrival - Date.now()) / 3_600_000
    : positionEstimate
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0
  const safeRemaining = Number.isFinite(scheduleEstimate) ? Math.max(0, scheduleEstimate) : safeTotal
  return { total: safeTotal, remaining: Math.min(safeTotal, safeRemaining) }
}

export function compactDuration(hours: number) {
  const totalMinutes = Number.isFinite(hours) ? Math.max(0, Math.round(hours * 60)) : 0
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return wholeHours ? `${wholeHours}h${minutes.toString().padStart(2, '0')}` : `${minutes} min`
}
