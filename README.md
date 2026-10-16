# AeroScope

Tableau de bord de suivi aérien en direct avec trafic ADS-B, trajectoire estimée, visualisation 3D orbitable et ambiance sonore de réacteur.

## Lancer le projet

```bash
npm install
npm run dev
```

Le proxy Vite relaie `/api/aircraft` vers l'API publique `api.adsb.lol` afin d'éviter les restrictions CORS pendant le développement et l'aperçu local.

## Sources

- Trafic aérien : [adsb.lol](https://adsb.lol), données ODbL 1.0.
- Fond de carte : OpenStreetMap / CARTO.
- Modèles 3D principaux : A320, A350, A380, B737 et B787 par
  [amvlab/aircraft-models](https://github.com/amvlab/aircraft-models), CC BY 4.0.
- Modèles complémentaires : B747, B777, E190, CRJ900, ATR42 et Q400 par
  [Flightradar24 / FlightGear](https://github.com/Flightradar24/fr24-3d-models), GPL v2.
- Silhouettes de catégories complémentaires : avion d'affaires, avion léger,
  long-courrier, hélicoptère, chasseur et planeur par
  [FlightAirMap](https://github.com/Ysurac/FlightAirMap-3dmodels), GPL v2.
- Modèle de repli : « Regional jet aircraft », Innerscene, CC0 1.0.

La maquette est choisie automatiquement à partir du code type ICAO (`A320`,
`B38M`, `B77W`, etc.). Une silhouette de famille est utilisée pour les variantes
proches et le modèle générique ne s'affiche que si le type n'est pas reconnu.

Les textures couleur embarquées dans les GLB sont complétées au rendu par des
matériaux PBR, un microrelief de panneaux/rivets et un environnement lumineux de
studio. Les maquettes restent chargées uniquement à la demande.

En cas d'indisponibilité du flux ADS-B, l'interface passe automatiquement en mode démonstration avec un jeu de données local clairement signalé.
