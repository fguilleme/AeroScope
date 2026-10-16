import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Language = 'fr' | 'en'

const fr: Record<string, string> = {
  initializing: 'Initialisation du radar…', home: 'AeroScope accueil', liveTracking: 'Suivi en direct', airspace: 'Espace aérien', fleet3d: 'Flotte 3D', demoMode: 'DONNÉES DE SECOURS', connectingAdsb: 'CONNEXION ADS-B…', notifications: 'Notifications', menu: 'Menu',
  searchPlaceholder: 'Rechercher un vol, une ville ou une compagnie…', searchFlight: 'Rechercher un vol', recentFlights: 'VOLS CONSULTÉS RÉCEMMENT', nearbyFlights: 'VOLS À PROXIMITÉ', trafficArea: 'Zone de trafic', found: 'TROUVÉ', foundPlural: 'TROUVÉS', flight: 'VOL', flights: 'VOLS', noAircraft: 'Aucun appareil correspondant dans cette zone.', areaSearch: 'VOLS ACTIFS AU DÉPART DE', airlineSearch: 'VOLS ACTIFS DE LA COMPAGNIE', showArea: 'VOIR SUR LA CARTE', icaoCode: 'Code ICAO', noLiveScopeFlights: 'Aucun vol actif correspondant n’est actuellement visible dans la couverture ADS‑B.', airborne: 'appareils en vol', refresh: 'Actualiser',
  trackedFlight: 'VOL SUIVI', zone: 'ZONE', currentHeading: 'CAP ACTUEL', airline: 'COMPAGNIE', destination: 'DESTINATION', routeUnavailable: 'Destination indisponible', altitude: 'ALTITUDE', groundSpeed: 'VITESSE SOL', stable: 'niveau stable', soundOn: 'SON ACTIF', listen: 'ÉCOUTER', engineAmbience: 'ambiance réacteur',
  trafficMap: 'Carte trafic', trajectory: 'Trajectoire', view3d: 'Vue 3D', updated: 'Mise à jour', communityFooter: 'Données ADS‑B communautaires · Modèles 3D sous licences ouvertes · Fond © OpenStreetMap / CARTO', soundExperience: 'Expérience sonore interactive',
  activeFlight: 'VOL ACTIF', registration: 'Immatriculation', aircraftType: 'Type appareil', operator: 'Opérateur', undisclosed: 'Non communiqué', unknownOperator: 'Opérateur non identifié', transponder: 'Code transpondeur', flightDetails: 'DÉTAILS DU VOL', adsbSource: 'SOURCE ADS‑B', sourceHelp: 'Données de position communautaires. Elles peuvent être partielles, retardées ou indisponibles selon la couverture.', heading: 'CAP', regionParis: 'Paris', regionLondon: 'Londres', regionNewYork: 'New York', regionGps: 'Ma position', locating: 'Localisation…', gpsUnavailable: 'GPS indisponible',
  selectedFlight: 'Vol sélectionné', otherFlights: 'Autres vols', plannedRoute: 'Route directe', estimatedMapTrail: 'Trace récente estimée', selectFlight: 'Sélectionner le vol', zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', centerFlight: 'Centrer sur le vol', lightMap: 'Fond clair', darkMap: 'Fond sombre', selectedFlightCaps: 'VOL SÉLECTIONNÉ', speed: 'VITESSE', departure: 'Départ', arrival: 'Arrivée', totalShort: 'Total', remainingShort: 'Restant', estimatedShort: 'estimé',
  trace24: 'TRACE DE VOL · DERNIÈRES 24 MINUTES', previousPosition: 'POSITION ANTÉRIEURE', currentPosition: 'POSITION ACTUELLE', estimatedTrace: 'Trace estimée', adsbPoint: 'Point ADS‑B', now: 'Maintenant', altitudeProfile: 'Profil d’altitude estimé', telemetry: 'TÉLÉMÉTRIE', currentPhase: 'Phase actuelle', barometricAltitude: 'Altitude barométrique', metricAltitude: 'Altitude métrique', trueHeading: 'Cap vrai', verticalSpeed: 'Vitesse verticale', signalQuality: 'QUALITÉ DU SIGNAL', veryGoodReception: 'Réception très bonne', receivedNow: 'Position reçue à l’instant. La portion antérieure est une estimation basée sur le cap et la vitesse actuels.', receivedAgo: 'Position reçue il y a {seconds} s. La portion antérieure est une estimation basée sur le cap et la vitesse actuels.',
  modelDetection: 'MODÈLE 3D · DÉTECTION ICAO', fallbackModel: 'MODÈLE DE REPLI', exactMatch: 'CORRESPONDANCE EXACTE', familyMatch: 'FAMILLE CORRESPONDANTE', modelUnavailable: 'Maquette indisponible', dataAccessible: 'Les données du vol restent accessibles.', autoRotation: 'Rotation auto', recenter: 'Recentrer', orbitHint: 'Glissez pour orbiter · molette pour zoomer', trackedAircraft: 'APPAREIL SUIVI', fallbackDescription: 'Le type ICAO ne correspond pas encore à une maquette dédiée. Le jet régional générique sert de modèle de repli.', modelDescription: 'Le code ICAO {type} sélectionne automatiquement la maquette {model}. Les variantes proches utilisent la silhouette de leur famille.', colorTexture: 'Texture couleur', pbrFinish: 'Finition PBR', aluminumRelief: 'Microrelief aluminium', category: 'Catégorie', detectedType: 'TYPE DÉTECTÉ', loadedModel: 'MODÈLE CHARGÉ', modelSource: 'MODÈLE SOURCE', loadedOnDemand: 'modèle chargé à la demande',
  loading: 'Chargement', departsIn: 'PART DANS {time}', landed: 'ATTERRI', inFlight: 'EN VOL', awaitingSignal: 'EN ATTENTE DU SIGNAL', scheduled: 'PROGRAMMÉ', minutesAgoShort: 'il y a {minutes} min', phaseCruise: 'Croisière', phaseClimb: 'Montée', phaseDescent: 'Descente', phaseGround: 'Au sol', rightNow: 'à l’instant', secondsAgo: 'il y a {seconds} s', ground: 'SOL',
}

const en: Record<string, string> = {
  initializing: 'Initializing radar…', home: 'AeroScope home', liveTracking: 'Live tracking', airspace: 'Airspace', fleet3d: '3D fleet', demoMode: 'BACKUP DATA', connectingAdsb: 'CONNECTING ADS-B…', notifications: 'Notifications', menu: 'Menu',
  searchPlaceholder: 'Search a flight, city or airline…', searchFlight: 'Search a flight', recentFlights: 'RECENTLY VIEWED FLIGHTS', nearbyFlights: 'NEARBY FLIGHTS', trafficArea: 'Traffic area', found: 'FOUND', foundPlural: 'FOUND', flight: 'FLIGHT', flights: 'FLIGHTS', noAircraft: 'No matching aircraft in this area.', areaSearch: 'ACTIVE FLIGHTS DEPARTING FROM', airlineSearch: 'ACTIVE AIRLINE FLIGHTS', showArea: 'SHOW ON MAP', icaoCode: 'ICAO code', noLiveScopeFlights: 'No matching active flight is currently visible in ADS-B coverage.', airborne: 'aircraft airborne', refresh: 'Refresh',
  trackedFlight: 'TRACKED FLIGHT', zone: 'AREA', currentHeading: 'CURRENT HEADING', airline: 'AIRLINE', destination: 'DESTINATION', routeUnavailable: 'Destination unavailable', altitude: 'ALTITUDE', groundSpeed: 'GROUND SPEED', stable: 'level flight', soundOn: 'SOUND ON', listen: 'LISTEN', engineAmbience: 'jet ambience',
  trafficMap: 'Traffic map', trajectory: 'Trajectory', view3d: '3D view', updated: 'Updated', communityFooter: 'Community ADS‑B data · Open-license 3D models · Map © OpenStreetMap / CARTO', soundExperience: 'Interactive sound experience',
  activeFlight: 'ACTIVE FLIGHT', registration: 'Registration', aircraftType: 'Aircraft type', operator: 'Operator', undisclosed: 'Not provided', unknownOperator: 'Unknown operator', transponder: 'Transponder code', flightDetails: 'FLIGHT DETAILS', adsbSource: 'ADS‑B SOURCE', sourceHelp: 'Community position data may be partial, delayed, or unavailable depending on coverage.', heading: 'HEADING', regionParis: 'Paris', regionLondon: 'London', regionNewYork: 'New York', regionGps: 'My location', locating: 'Locating…', gpsUnavailable: 'GPS unavailable',
  selectedFlight: 'Selected flight', otherFlights: 'Other flights', plannedRoute: 'Direct route', estimatedMapTrail: 'Estimated recent trail', selectFlight: 'Select flight', zoomIn: 'Zoom in', zoomOut: 'Zoom out', centerFlight: 'Center on flight', lightMap: 'Light map', darkMap: 'Dark map', selectedFlightCaps: 'SELECTED FLIGHT', speed: 'SPEED', departure: 'Origin', arrival: 'Destination', totalShort: 'Total', remainingShort: 'Remaining', estimatedShort: 'estimate',
  trace24: 'FLIGHT TRACE · LAST 24 MINUTES', previousPosition: 'PREVIOUS POSITION', currentPosition: 'CURRENT POSITION', estimatedTrace: 'Estimated trace', adsbPoint: 'ADS‑B point', now: 'Now', altitudeProfile: 'Estimated altitude profile', telemetry: 'TELEMETRY', currentPhase: 'Current phase', barometricAltitude: 'Barometric altitude', metricAltitude: 'Metric altitude', trueHeading: 'True heading', verticalSpeed: 'Vertical speed', signalQuality: 'SIGNAL QUALITY', veryGoodReception: 'Very good reception', receivedNow: 'Position received just now. The previous section is estimated from current heading and speed.', receivedAgo: 'Position received {seconds} s ago. The previous section is estimated from current heading and speed.',
  modelDetection: '3D MODEL · ICAO DETECTION', fallbackModel: 'FALLBACK MODEL', exactMatch: 'EXACT MATCH', familyMatch: 'FAMILY MATCH', modelUnavailable: 'Model unavailable', dataAccessible: 'Flight data remains available.', autoRotation: 'Auto rotate', recenter: 'Recenter', orbitHint: 'Drag to orbit · scroll to zoom', trackedAircraft: 'TRACKED AIRCRAFT', fallbackDescription: 'This ICAO type does not have a dedicated model yet. A generic regional jet is used as a fallback.', modelDescription: 'ICAO code {type} automatically selects the {model} model. Related variants use their family silhouette.', colorTexture: 'Color texture', pbrFinish: 'PBR finish', aluminumRelief: 'Aluminum microdetail', category: 'Category', detectedType: 'DETECTED TYPE', loadedModel: 'LOADED MODEL', modelSource: 'MODEL SOURCE', loadedOnDemand: 'model loaded on demand',
  loading: 'Loading', departsIn: 'DEPARTS IN {time}', landed: 'LANDED', inFlight: 'IN FLIGHT', awaitingSignal: 'AWAITING ADS-B SIGNAL', scheduled: 'SCHEDULED', minutesAgoShort: '{minutes} min ago', phaseCruise: 'Cruise', phaseClimb: 'Climb', phaseDescent: 'Descent', phaseGround: 'On ground', rightNow: 'just now', secondsAgo: '{seconds} s ago', ground: 'GROUND',
}

type I18nValue = { language: Language; locale: string; t: (key: string, values?: Record<string, string | number>) => string }
const I18nContext = createContext<I18nValue>({ language: 'fr', locale: 'fr-FR', t: key => fr[key] || key })

function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'fr'
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language]
  return preferences.some(item => item.toLowerCase().startsWith('en')) ? 'en' : 'fr'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLanguage)
  useEffect(() => {
    const update = () => setLanguage(detectLanguage())
    window.addEventListener('languagechange', update)
    return () => window.removeEventListener('languagechange', update)
  }, [])
  useEffect(() => {
    document.documentElement.lang = language
    document.title = language === 'en' ? 'AeroScope — Flight tracking' : 'AeroScope — Suivi de vol'
    document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'en'
      ? 'AeroScope — live air traffic, flight trajectory and interactive 3D aircraft.'
      : 'AeroScope — suivi aérien en direct, trajectoire et visualisation 3D interactive.')
  }, [language])
  const value = useMemo<I18nValue>(() => {
    const dictionary = language === 'en' ? en : fr
    return {
      language,
      locale: language === 'en' ? 'en-US' : 'fr-FR',
      t: (key, values) => Object.entries(values || {}).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), dictionary[key] || fr[key] || key),
    }
  }, [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
