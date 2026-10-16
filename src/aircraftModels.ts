import type { Aircraft } from './types'

export type AircraftModel = {
  key: string
  path: string
  label: string
  representedTypes: string
  source: 'amvlab' | 'Flightradar24 / FlightGear' | 'FlightAirMap' | 'Innerscene'
  license: 'CC BY 4.0' | 'GPL v2' | 'CC0'
  sourceUrl: string
  match: 'exact' | 'family' | 'fallback'
  rotation?: [number, number, number]
}

const AMV_SOURCE = 'https://github.com/amvlab/aircraft-models'
const FR24_SOURCE = 'https://github.com/Flightradar24/fr24-3d-models'
const FAM_SOURCE = 'https://github.com/Ysurac/FlightAirMap-3dmodels'

const model = (
  key: string,
  label: string,
  representedTypes: string,
  source: AircraftModel['source'],
  license: AircraftModel['license'],
  sourceUrl: string,
  match: AircraftModel['match'] = 'exact',
  rotation: [number, number, number] = [0.04, -0.55, 0.02],
): AircraftModel => ({ key, path: `/models/aircraft/${key}.glb?v=textures-20261016`, label, representedTypes, source, license, sourceUrl, match, rotation })

const MODELS = {
  a320: model('a320', 'Airbus A320', 'A318 · A319 · A320 · A321 · neo', 'amvlab', 'CC BY 4.0', AMV_SOURCE, 'family'),
  a350: model('a350', 'Airbus A350', 'A350-900 · A350-1000', 'amvlab', 'CC BY 4.0', AMV_SOURCE, 'family'),
  a380: model('a380', 'Airbus A380', 'A380-800', 'amvlab', 'CC BY 4.0', AMV_SOURCE),
  b737: model('b737', 'Boeing 737', '737 NG · 737 MAX', 'amvlab', 'CC BY 4.0', AMV_SOURCE, 'family'),
  b787: model('b787', 'Boeing 787', '787-8 · 787-9 · 787-10', 'amvlab', 'CC BY 4.0', AMV_SOURCE, 'family'),
  b777: model('b777', 'Boeing 777-300', '777-200 · 777-300 · 777F', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  b747: model('b747', 'Boeing 747-400', '747-400 · 747-8', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  e190: model('e190', 'Embraer E190', 'E170 · E175 · E190 · E195', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  crj900: model('crj900', 'Bombardier CRJ-900', 'CRJ-700 · CRJ-900 · CRJ-1000', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  atr42: model('atr42', 'ATR 42', 'ATR 42 · ATR 72', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  q400: model('q400', 'Dash 8 Q400', 'DHC-8 · Dash 8 Q400', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  drone: model('drone', 'Drone', 'Aéronefs sans pilote', 'amvlab', 'CC BY 4.0', AMV_SOURCE, 'family'),
  evtol: model('evtol', 'eVTOL', 'Mobilité aérienne avancée', 'amvlab', 'CC BY 4.0', AMV_SOURCE, 'family'),
  widebody2: model('widebody-2eng', 'Long-courrier biréacteur', 'A300 · A310 · A330 · B767', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  widebody4: model('widebody-4eng', 'Long-courrier quadriréacteur', 'Airbus A340 et similaires', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  bizjet: model('bizjet', 'Jet d’affaires', 'Citation · Falcon · Gulfstream · Challenger', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  lightProp: model('light-prop', 'Avion léger à hélice', 'Cessna · Piper · Cirrus · Beechcraft', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  helicopter: model('helicopter', 'Hélicoptère', 'Rotorcraft', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  fighter: model('fighter', 'Avion haute performance', 'Chasseurs et avions militaires rapides', 'FlightAirMap', 'GPL v2', FAM_SOURCE, 'family'),
  glider: model('glider', 'Planeur', 'Planeurs et motoplaneurs', 'Flightradar24 / FlightGear', 'GPL v2', FR24_SOURCE, 'family'),
  regional: model('regional-jet-aircraft', 'Jet régional générique', 'Type non reconnu', 'Innerscene', 'CC0', 'https://www.innerscene.com/tools/library/3d-parts/regional-jet-aircraft-ae1f8f3d', 'fallback'),
} satisfies Record<string, AircraftModel>

export function resolveAircraftModel(aircraft: Aircraft): AircraftModel {
  const type = (aircraft.t || '').trim().toUpperCase()

  if (/^A3(18|19|20|21)$|^A2[01]N$/.test(type)) return MODELS.a320
  if (/^A35[0-9K]$/.test(type)) return MODELS.a350
  if (/^A38[0-9]$/.test(type)) return MODELS.a380
  if (/^A30[0-9B]$|^A310$|^A33[0-9]$/.test(type)) return MODELS.widebody2
  if (/^A34[0-9]$/.test(type)) return MODELS.widebody4
  if (/^B73[6-9]$|^B3[789]M$/.test(type)) return MODELS.b737
  if (/^B78[789X]$/.test(type)) return MODELS.b787
  if (/^B77[0-9LW]$/.test(type)) return MODELS.b777
  if (/^B74[0-9FRSP]$/.test(type)) return MODELS.b747
  if (/^B76[0-9]$/.test(type)) return MODELS.widebody2
  if (/^E1(7[05]|9[05])$|^E2(75|90|95)$/.test(type)) return MODELS.e190
  if (/^E1[34][05]$|^BCS[13]$|^F(70|100)$/.test(type)) return MODELS.regional
  if (/^CRJ[1279X]$/.test(type)) return MODELS.crj900
  if (/^AT[467][0-9]$/.test(type)) return MODELS.atr42
  if (/^DH8[ABCD]$/.test(type)) return MODELS.q400
  if (/^(DRON|UAV|RPAS)$/.test(type) || aircraft.category === 'B6') return MODELS.drone
  if (/^(EVTL|EVTO)$/.test(type)) return MODELS.evtol
  if (/^(C25[ABC]|C5[256]|C6[058]|C700|CL3[05]|CL60|FA(10|20|50|7X|8X|9X)|F2TH|F900|GLEX|GL[5-7]T|GLF[2-6]|H25[ABC]|LJ[2367]5|E(50P|55P)|PRM1)$/.test(type)) return MODELS.bizjet
  if (/^(C1(50|52|72|77|82)|C2(06|08|10)|PA(18|24|28|31|32|34|44|46)|SR2[02]|BE(20|33|35|36|40|55|58))$/.test(type)) return MODELS.lightProp
  if (/^(AS(32|50|55|65)|B06|B407|EC(20|25|30|35|45|55)|H(500|60|65)|R(22|44|66)|S(76|92))$/.test(type) || aircraft.category === 'A7') return MODELS.helicopter
  if (aircraft.category === 'A6') return MODELS.fighter
  if (aircraft.category === 'B1') return MODELS.glider

  if (aircraft.category === 'A1') return MODELS.lightProp
  if (aircraft.category === 'A2') return MODELS.regional
  if (aircraft.category === 'A3' || aircraft.category === 'A4') return MODELS.a320
  if (aircraft.category === 'A5') return MODELS.widebody2

  return MODELS.regional
}

export const supportedModelFamilies = Object.values(MODELS).filter(item => item.match !== 'fallback')
