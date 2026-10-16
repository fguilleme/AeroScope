import { useEffect, useRef, useState } from 'react'

export function useEngineSound(speed = 350) {
  const [playing, setPlaying] = useState(false)
  const contextRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const nodesRef = useRef<AudioScheduledSourceNode[]>([])

  const stop = () => {
    const context = contextRef.current
    const master = masterRef.current
    if (context && master) {
      master.gain.cancelScheduledValues(context.currentTime)
      master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25)
      window.setTimeout(() => {
        nodesRef.current.forEach(node => { try { node.stop() } catch { /* already stopped */ } })
        void context.close()
      }, 280)
    }
    nodesRef.current = []
    contextRef.current = null
    masterRef.current = null
    setPlaying(false)
  }

  const start = () => {
    if (playing) return stop()
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioContextClass()
    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    const filter = context.createBiquadFilter()
    master.gain.setValueAtTime(0.0001, context.currentTime)
    master.gain.exponentialRampToValueAtTime(0.085, context.currentTime + 0.7)
    filter.type = 'lowpass'
    filter.frequency.value = 820
    filter.Q.value = 1.4
    master.connect(filter).connect(compressor).connect(context.destination)

    const base = 37 + Math.min(speed, 550) / 28
    const oscillators = [base, base * 2.01, base * 3.98].map((frequency, index) => {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = index === 0 ? 'sawtooth' : 'sine'
      osc.frequency.value = frequency
      gain.gain.value = [0.34, 0.18, 0.06][index]
      osc.connect(gain).connect(master)
      osc.start()
      return osc
    })

    const bufferSize = context.sampleRate * 2
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = context.createBufferSource()
    const noiseFilter = context.createBiquadFilter()
    const noiseGain = context.createGain()
    noise.buffer = buffer
    noise.loop = true
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 330
    noiseFilter.Q.value = 0.7
    noiseGain.gain.value = 0.08
    noise.connect(noiseFilter).connect(noiseGain).connect(master)
    noise.start()

    contextRef.current = context
    masterRef.current = master
    nodesRef.current = [...oscillators, noise]
    setPlaying(true)
  }

  useEffect(() => stop, [])
  return { playing, toggle: start }
}
