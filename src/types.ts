export type Aircraft = {
  hex: string
  flight?: string
  r?: string
  t?: string
  desc?: string
  ownOp?: string
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  track?: number
  baro_rate?: number
  lat?: number
  lon?: number
  squawk?: string
  category?: string
  seen?: number
  seen_pos?: number
  messages?: number
  rssi?: number
  nav_heading?: number
  nav_altitude_mcp?: number
  emergency?: string
  nic?: number
  trackingState?: 'scheduled' | 'live' | 'landed'
  scheduledDeparture?: string
  scheduledArrival?: string
  adsbCallsign?: string
  aliases?: string[]
}

export type FlightPhase = 'cruise' | 'climb' | 'descent' | 'ground'

export type Region = {
  id: string
  name: string
  detail: string
  lat: number
  lon: number
  radius: number
  zoom: number
}

export type Airport = {
  country_iso_name?: string
  country_name?: string
  iata_code?: string
  icao_code?: string
  latitude: number
  longitude: number
  municipality?: string
  name?: string
}

export type FlightRoute = {
  callsign: string
  callsign_icao?: string
  callsign_iata?: string
  airline?: {
    name?: string
    icao?: string
    iata?: string
  }
  origin: Airport
  destination: Airport
}
