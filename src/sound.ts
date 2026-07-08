// WebAudio synth. No samples: everything generated from oscillators and noise.
import { load, save } from './storage'

export type SoundKind =
  | 'tap'
  | 'star'
  | 'planet'
  | 'nova'
  | 'hole'
  | 'merge'
  | 'evaporate'
  | 'ending'

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  muted: boolean = load('muted', false)

  // Call from a user gesture (pointer down) so the context is allowed to start.
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.4
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean): void {
    this.muted = m
    save('muted', m)
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.4, this.ctx.currentTime, 0.05)
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, glideTo?: number): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur)
  }

  private noise(dur: number, gain: number, cutoffFrom: number, cutoffTo: number): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const len = Math.ceil(this.ctx.sampleRate * dur)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoffFrom, t)
    filter.frequency.exponentialRampToValueAtTime(cutoffTo, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
  }

  play(kind: SoundKind): void {
    if (!this.ctx) return
    switch (kind) {
      case 'tap': this.tone(520, 0.12, 'sine', 0.25, 700); break
      case 'star':
        this.tone(392, 0.5, 'triangle', 0.2)
        this.tone(587, 0.6, 'triangle', 0.15)
        break
      case 'planet': this.tone(880, 0.25, 'sine', 0.12, 660); break
      case 'nova':
        this.noise(0.9, 0.5, 3200, 120)
        this.tone(180, 0.7, 'sawtooth', 0.15, 40)
        break
      case 'hole': this.tone(120, 1.1, 'sine', 0.35, 28); break
      case 'merge': this.tone(60, 1.4, 'sine', 0.3, 24); break
      case 'evaporate': this.tone(300, 0.8, 'sine', 0.1, 1400); break
      case 'ending':
        this.tone(262, 2.2, 'sine', 0.15)
        this.tone(330, 2.2, 'sine', 0.12)
        this.tone(392, 2.4, 'sine', 0.1)
        break
    }
  }

  startHum(): void {
    if (!this.ctx || !this.master || this.humOsc) return
    this.humOsc = this.ctx.createOscillator()
    this.humGain = this.ctx.createGain()
    this.humOsc.type = 'sine'
    this.humOsc.frequency.value = 55
    this.humGain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    this.humGain.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 0.4)
    this.humOsc.connect(this.humGain)
    this.humGain.connect(this.master)
    this.humOsc.start()
  }

  stopHum(): void {
    if (!this.ctx || !this.humOsc || !this.humGain) return
    this.humGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1)
    const osc = this.humOsc
    window.setTimeout(() => osc.stop(), 500)
    this.humOsc = null
    this.humGain = null
  }
}
