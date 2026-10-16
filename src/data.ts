import type { Aircraft, Region } from './types'

export const regions: Region[] = [
  { id: 'paris', name: 'Paris', detail: '100 NM', lat: 48.8566, lon: 2.3522, radius: 100, zoom: 6.5 },
  { id: 'london', name: 'Londres', detail: '100 NM', lat: 51.5072, lon: -0.1276, radius: 100, zoom: 6.5 },
  { id: 'new-york', name: 'New York', detail: '100 NM', lat: 40.7128, lon: -74.006, radius: 100, zoom: 6.4 },
]

export const fallbackAircraft: Aircraft[] = [
  { hex: '39bda7', flight: 'AFR178', r: 'F-GZNP', t: 'B77W', desc: 'Boeing 777-300ER', ownOp: 'Air France', alt_baro: 35800, gs: 472, track: 132, baro_rate: 64, lat: 49.12, lon: 1.42, squawk: '1256', category: 'A5', seen: 0.3, messages: 42892, rssi: -13.2 },
  { hex: '4ca8e8', flight: 'RYR8NL', r: 'EI-ENV', t: 'B738', desc: 'Boeing 737-800', ownOp: 'Ryanair', alt_baro: 28600, gs: 431, track: 214, baro_rate: -1152, lat: 49.48, lon: 2.84, squawk: '1000', category: 'A3', seen: 0.7, messages: 19720, rssi: -18.1 },
  { hex: '4008b5', flight: 'BAW303', r: 'G-EUPA', t: 'A319', desc: 'Airbus A319', ownOp: 'British Airways', alt_baro: 22100, gs: 387, track: 317, baro_rate: 1280, lat: 48.61, lon: 1.28, squawk: '5764', category: 'A3', seen: 0.4, messages: 31804, rssi: -15.4 },
  { hex: '3c65c4', flight: 'DLH1051', r: 'D-AINC', t: 'A20N', desc: 'Airbus A320neo', ownOp: 'Lufthansa', alt_baro: 37000, gs: 451, track: 76, baro_rate: 0, lat: 49.82, lon: 3.48, squawk: '1000', category: 'A3', seen: 0.2, messages: 51943, rssi: -11.8 },
  { hex: '4841aa', flight: 'KLM1412', r: 'PH-BXA', t: 'B738', desc: 'Boeing 737-800', ownOp: 'KLM', alt_baro: 32000, gs: 440, track: 22, baro_rate: 640, lat: 48.21, lon: 2.98, squawk: '3234', category: 'A3', seen: 0.9, messages: 12488, rssi: -20.1 },
  { hex: '4b18f2', flight: 'SWR23K', r: 'HB-JCM', t: 'BCS3', desc: 'Airbus A220-300', ownOp: 'SWISS', alt_baro: 18800, gs: 362, track: 145, baro_rate: -960, lat: 48.43, lon: 3.92, squawk: '7612', category: 'A3', seen: 0.5, messages: 8321, rssi: -17.4 },
]

export const watchedFlights: Aircraft[] = [
  {
    hex: 'scheduled-ux64-20261016',
    flight: 'UX64',
    t: 'B789',
    desc: 'Boeing 787-9 Dreamliner',
    ownOp: 'Air Europa',
    lat: 21.0365,
    lon: -86.8771,
    track: 59,
    trackingState: 'scheduled',
    scheduledDeparture: '2026-10-17T01:40:00Z',
    scheduledArrival: '2026-10-17T11:10:00Z',
    adsbCallsign: 'AEA64',
    aliases: ['UX64', 'UX064', 'AEA64', 'AEA064'],
  },
]

export const airlineFromCallsign = (callsign = '') => {
  const code = callsign.trim().slice(0, 3)
  return ({ AFR: 'Air France', RYR: 'Ryanair', BAW: 'British Airways', DLH: 'Lufthansa', KLM: 'KLM', SWR: 'SWISS', EZY: 'easyJet', UAL: 'United Airlines', DAL: 'Delta Air Lines', VIR: 'Virgin Atlantic', UAE: 'Emirates', QTR: 'Qatar Airways' } as Record<string, string>)[code] || 'Opérateur non identifié'
}

export const aircraftName = (type = '') => ({
  A20N: 'Airbus A320neo', A21N: 'Airbus A321neo', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321', A332: 'Airbus A330-200', A333: 'Airbus A330-300', A359: 'Airbus A350-900',
  B38M: 'Boeing 737 MAX 8', B738: 'Boeing 737-800', B739: 'Boeing 737-900', B744: 'Boeing 747-400', B77W: 'Boeing 777-300ER', B788: 'Boeing 787-8', B789: 'Boeing 787-9',
  BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300', E190: 'Embraer E190', E195: 'Embraer E195', CRJ9: 'Bombardier CRJ-900',
} as Record<string, string>)[type] || type || 'Type non communiqué'
