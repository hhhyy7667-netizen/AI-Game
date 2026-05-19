/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class GameAudio {
  private ctx: AudioContext | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private masterGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3;
  }

  playBGM() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    this.stopBGM();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "square";
    // Simple 8-bit loop
    const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    let step = 0;

    const tick = () => {
      if (!this.bgmOsc) return;
      osc.frequency.setValueAtTime(melody[step % melody.length], this.ctx!.currentTime);
      step++;
      setTimeout(tick, 200);
    };

    osc.start();
    osc.connect(gain);
    gain.connect(this.masterGain!);
    gain.gain.value = 0.05;

    this.bgmOsc = osc;
    tick();
  }

  stopBGM() {
    if (this.bgmOsc) {
      this.bgmOsc.stop();
      this.bgmOsc = null;
    }
  }

  playPickup() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(500, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.masterGain!);
    source.start();
  }
}

export const gameAudio = new GameAudio();
