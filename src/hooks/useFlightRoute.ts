import { useEffect, useState } from 'react'
import type { FlightRoute } from '../types'

type RoutePayload = {
  response?: {
    flightroute?: FlightRoute
  }
}

export function useFlightRoute(callsign?: string) {
  const [route, setRoute] = useState<FlightRoute | null>(null)

  useEffect(() => {
    const normalized = callsign?.trim()
    setRoute(null)
    if (!normalized) return
    const controller = new AbortController()
    let cancelled = false
    void fetch(`/api/route/${encodeURIComponent(normalized)}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<RoutePayload>
      })
      .then(payload => {
        const next = payload.response?.flightroute
        if (!next || typeof next.origin?.latitude !== 'number' || typeof next.destination?.latitude !== 'number') return
        if (!cancelled) setRoute(next)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!cancelled) setRoute(null)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [callsign])

  return route
}
