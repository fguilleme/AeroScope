import { useCallback, useEffect, useMemo, useState } from 'react'
import { aircraftName, airlineFromCallsign, fallbackAircraft } from '../data'
import type { Aircraft, Region } from '../types'
import { fetchOpenSkyAircraft } from '../services/opensky'

const REFRESH_MS = 20_000

export function useFlightData(region: Region) {
  const [aircraft, setAircraft] = useState<Aircraft[]>(fallbackAircraft)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/aircraft/lat/${region.lat}/lon/${region.lon}/dist/${region.radius}`, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json() as { ac?: Aircraft[] }
      const valid = (payload.ac || [])
        .filter(item => typeof item.lat === 'number' && typeof item.lon === 'number')
        .map(item => ({ ...item, flight: item.flight?.trim(), desc: item.desc || aircraftName(item.t), ownOp: item.ownOp || airlineFromCallsign(item.flight) }))
      if (!valid.length) throw new Error('Aucun aéronef reçu')
      setAircraft(valid)
      setIsLive(true)
      setError(null)
      setLastUpdate(new Date())
    } catch (reason) {
      try {
        const fallback = await fetchOpenSkyAircraft(region, AbortSignal.timeout(10_000))
        if (!fallback.length) throw reason
        setAircraft(fallback)
        setIsLive(true)
        setError(null)
        setLastUpdate(new Date())
      } catch {
        setIsLive(false)
        setError(reason instanceof Error ? reason.message : 'Source indisponible')
        setAircraft(current => current.length ? current : fallbackAircraft)
      }
    } finally {
      setLoading(false)
    }
  }, [region])

  useEffect(() => {
    setLoading(true)
    void refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const airborne = useMemo(() => aircraft.filter(item => item.alt_baro !== 'ground').length, [aircraft])
  return { aircraft, loading, isLive, lastUpdate, error, refresh, airborne }
}
