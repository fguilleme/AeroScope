import { Activity, Gauge, Radio, Route, ShieldCheck } from 'lucide-react'
import type { Aircraft } from '../types'
import { clean, feet, heading, kmh, phaseKey, phaseOf } from '../utils'
import { useI18n } from '../i18n'

export default function FlightDetails({ aircraft, statusLabel }: { aircraft: Aircraft; statusLabel?: string | null }) {
  const { locale, t } = useI18n()
  const phase = phaseOf(aircraft)
  const operator = !aircraft.ownOp || aircraft.ownOp === 'Opérateur non identifié' ? t('unknownOperator') : aircraft.ownOp
  const rows = [
    [t('registration'), clean(aircraft.r)],
    [t('aircraftType'), aircraft.desc || clean(aircraft.t)],
    [t('operator'), operator || t('undisclosed')],
    [t('transponder'), aircraft.trackingState === 'scheduled' ? t('awaitingSignal') : aircraft.hex.toUpperCase()],
    ['Squawk', clean(aircraft.squawk)],
  ]
  return <aside className="flight-sidebar">
    <section className="panel identity-card">
      <div className="card-heading"><div><span>{t('activeFlight')}</span><h2>{clean(aircraft.flight)}</h2></div><div className="radar-pulse"><i/><Radio size={17}/></div></div>
      <div className="operator"><span>{(operator || 'AIR').slice(0, 2).toUpperCase()}</span><div><strong>{operator}</strong><small>{aircraft.desc || aircraft.t}</small></div></div>
      <div className={`status-ribbon ${aircraft.trackingState || ''}`}><i /> {statusLabel || t(phaseKey(phase)).toUpperCase()} {!statusLabel && <><span>•</span> {aircraft.seen !== undefined && aircraft.seen >= 2 ? t('secondsAgo', { seconds: Math.round(aircraft.seen) }) : t('rightNow')}</>}</div>
    </section>

    <section className="panel quick-stats">
      <div><Gauge size={18}/><span>{t('groundSpeed')}</span><strong>{kmh(aircraft.gs)}</strong></div>
      <div><Activity size={18}/><span>{t('altitude')}</span><strong>{feet(aircraft.alt_baro, locale, t('ground'))}</strong></div>
      <div><Route size={18}/><span>{t('heading')}</span><strong>{heading(aircraft.track)}</strong></div>
    </section>

    <section className="panel details-card">
      <div className="panel-title"><span>{t('flightDetails')}</span><ShieldCheck size={15}/></div>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>

    <section className="panel source-card">
      <div className="source-live"><i/>{t('adsbSource')}</div>
      <p>{t('sourceHelp')}</p>
      <a href="https://adsb.lol" target="_blank" rel="noreferrer">adsb.lol ↗</a>
    </section>
  </aside>
}
