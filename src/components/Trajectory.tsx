import { ArrowDownRight, ArrowUpRight, CircleDot, Navigation2 } from 'lucide-react'
import type { Aircraft } from '../types'
import { clean, feet, heading, kmh, meters, phaseKey, phaseOf } from '../utils'
import { useI18n } from '../i18n'

export default function Trajectory({ aircraft }: { aircraft: Aircraft }) {
  const { locale, t } = useI18n()
  const altitude = meters(aircraft.alt_baro)
  const phase = phaseOf(aircraft)
  const rate = aircraft.baro_rate || 0
  const points = [
    { time: t('minutesAgoShort', { minutes: 24 }), alt: Math.max(altitude - rate * 24 * 0.3048, altitude * 0.76), label: t('estimatedTrace') },
    { time: t('minutesAgoShort', { minutes: 16 }), alt: Math.max(altitude - rate * 16 * 0.3048, altitude * 0.84), label: t('adsbPoint') },
    { time: t('minutesAgoShort', { minutes: 8 }), alt: Math.max(altitude - rate * 8 * 0.3048, altitude * 0.92), label: t('adsbPoint') },
    { time: t('now'), alt: altitude, label: clean(aircraft.flight) },
  ]
  const maxAlt = Math.max(...points.map(p => p.alt), 1000)
  const chart = points.map((point, i) => `${10 + i * 29},${88 - (point.alt / maxAlt) * 66}`).join(' ')

  return <div className="trajectory-view">
    <section className="trajectory-hero panel">
      <div className="eyebrow"><Navigation2 size={13} /> {t('trace24')}</div>
      <div className="route-title-row">
        <div><span>{t('previousPosition')}</span><strong>{((aircraft.lat || 0) - 0.62).toFixed(2)}° N</strong><small>{((aircraft.lon || 0) - 0.9).toFixed(2)}° E</small></div>
        <div className="route-progress"><i /><i /><i /><i /><i className="active" /></div>
        <div className="destination"><span>{t('currentPosition')}</span><strong>{(aircraft.lat || 0).toFixed(2)}° N</strong><small>{(aircraft.lon || 0).toFixed(2)}° E</small></div>
      </div>
      <div className="altitude-chart">
        <div className="chart-label top">{Math.round(maxAlt / 1000)} km</div>
        <div className="chart-label bottom">0 km</div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={t('altitudeProfile')}>
          <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#caff55" stopOpacity=".24"/><stop offset="1" stopColor="#caff55" stopOpacity="0"/></linearGradient></defs>
          <path d={`M ${chart.replaceAll(' ', ' L ')} L 97,94 L 10,94 Z`} fill="url(#area)" />
          <polyline points={chart} fill="none" stroke="#caff55" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
          {points.map((point, i) => <circle key={point.time} cx={10 + i * 29} cy={88 - (point.alt / maxAlt) * 66} r={i === points.length - 1 ? 2.2 : 1.3} fill={i === points.length - 1 ? '#caff55' : '#82909c'} vectorEffect="non-scaling-stroke" />)}
        </svg>
        <div className="chart-times">{points.map(point => <span key={point.time}>{point.time}</span>)}</div>
      </div>
    </section>

    <div className="trajectory-grid">
      <section className="panel telemetry-card">
        <div className="panel-title"><span>{t('telemetry')}</span><small>ADS‑B</small></div>
        <div className="telemetry-list">
          <div><span>{t('currentPhase')}</span><strong><i className={`phase-dot ${phase}`} />{t(phaseKey(phase))}</strong></div>
          <div><span>{t('barometricAltitude')}</span><strong>{feet(aircraft.alt_baro, locale, t('ground'))}</strong></div>
          <div><span>{t('metricAltitude')}</span><strong>{altitude.toLocaleString(locale)} m</strong></div>
          <div><span>{t('groundSpeed')}</span><strong>{kmh(aircraft.gs)}</strong></div>
          <div><span>{t('trueHeading')}</span><strong>{heading(aircraft.track)}</strong></div>
          <div><span>{t('verticalSpeed')}</span><strong className={rate >= 0 ? 'positive' : 'negative'}>{rate >= 0 ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>} {Math.abs(rate).toLocaleString(locale)} ft/min</strong></div>
        </div>
      </section>
      <section className="panel signal-card">
        <div className="panel-title"><span>{t('signalQuality')}</span><small>LIVE</small></div>
        <div className="signal-main"><CircleDot size={21} /><div><strong>{aircraft.rssi ? Math.min(99, Math.max(35, Math.round(100 + aircraft.rssi * 2.8))) : 84}%</strong><span>{t('veryGoodReception')}</span></div></div>
        <div className="signal-bars">{Array.from({length: 18}, (_, i) => <i key={i} className={i < 15 ? 'filled' : ''} />)}</div>
        <p>{aircraft.seen && aircraft.seen > 2 ? t('receivedAgo', { seconds: Math.round(aircraft.seen) }) : t('receivedNow')}</p>
      </section>
    </div>
  </div>
}
