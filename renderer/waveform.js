'use strict';

class WaveformVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.stream = null;
    this.animFrameId = null;
    this.state = 'idle'; // idle | listening | paused
    this.externalAmplitude = null;
    this.smoothedData = [];
    this.pausedPulsePhase = 0;
    this.accentColor = '#00b4d8';

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.canvas);
    this._resize();
    this._startLoop();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this._logicalW = rect.width;
    this._logicalH = rect.height;
  }

  async connect(stream) {
    if (this.audioContext) {
      await this.audioContext.close();
    }
    this.stream = stream;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.smoothedData = new Array(this.analyser.frequencyBinCount).fill(128);
  }

  setState(state) {
    this.state = state;
  }

  setAccentColor(color) {
    this.accentColor = color;
  }

  setExternalAmplitude(value) {
    this.externalAmplitude = value;
  }

  _getFrequencyData() {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      for (let i = 0; i < this.dataArray.length; i++) {
        this.smoothedData[i] = this.smoothedData[i] * 0.75 + this.dataArray[i] * 0.25;
      }
      return this.smoothedData;
    }

    if (this.externalAmplitude !== null) {
      const len = 64;
      if (!this.smoothedData || this.smoothedData.length !== len) {
        this.smoothedData = new Array(len).fill(0);
      }
      const amp = this.externalAmplitude * 255;
      for (let i = 0; i < len; i++) {
        const wave = amp * (0.6 + 0.4 * Math.sin(i * 0.4 + Date.now() * 0.003));
        this.smoothedData[i] = this.smoothedData[i] * 0.7 + wave * 0.3;
      }
      return this.smoothedData;
    }

    const len = 64;
    if (!this.smoothedData || this.smoothedData.length !== len) {
      this.smoothedData = new Array(len).fill(0);
    }
    for (let i = 0; i < len; i++) {
      this.smoothedData[i] *= 0.9;
    }
    return this.smoothedData;
  }

  _avgAmplitude(data) {
    if (!data || data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / data.length / 255;
  }

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return { r, g, b };
  }

  _amplitudeColor(avg) {
    if (this.state === 'idle' || this.state === 'paused') {
      return 'rgba(144,144,168,0.6)';
    }
    const { r, g, b } = this._hexToRgb(this.accentColor);
    if (avg < 0.25) {
      return `rgba(${r},${g},${b},0.7)`;
    } else if (avg < 0.6) {
      const t = (avg - 0.25) / 0.35;
      const cr = Math.round(r * (1 - t) + 100 * t);
      const cg = Math.round(g * (1 - t) + 230 * t);
      const cb = Math.round(b * (1 - t) + 255 * t);
      return `rgba(${cr},${cg},${cb},0.9)`;
    } else {
      return 'rgba(200,240,255,1)';
    }
  }

  _drawWaveform(data) {
    const { ctx } = this;
    const W = this._logicalW || this.canvas.width;
    const H = this._logicalH || this.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const halfH = cy * 0.78;

    ctx.clearRect(0, 0, W, H);

    // Subtle trailing fade
    ctx.fillStyle = 'rgba(15,15,26,0.18)';
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'paused') {
      this._drawPausedLine(W, H, cy);
      return;
    }

    const avg = this._avgAmplitude(data);
    const color = this._amplitudeColor(avg);
    const len = data.length;
    
    // We'll use half the width for each side (left and right)
    const sideW = W / 2;
    const step = sideW / (len - 1);

    // Glow under line
    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.3, color);
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, 'transparent');

    // Draw mirrored waveform (top/bottom and left/right symmetry)
    for (const mirrorY of [1, -1]) {
      ctx.beginPath();

      // Right side points (from center to right)
      const rightPoints = [];
      for (let i = 0; i < len; i++) {
        const x = cx + i * step;
        const norm = (data[i] / 255);
        const y = cy - mirrorY * norm * halfH;
        rightPoints.push({ x, y });
      }

      // Left side points (from center to left)
      const leftPoints = [];
      for (let i = 0; i < len; i++) {
        const x = cx - i * step;
        const norm = (data[i] / 255);
        const y = cy - mirrorY * norm * halfH;
        leftPoints.push({ x, y });
      }

      // Draw the left side
      ctx.moveTo(leftPoints[len - 1].x, leftPoints[len - 1].y);
      for (let i = len - 2; i >= 0; i--) {
        const cpx = (leftPoints[i].x + (i > 0 ? leftPoints[i-1].x : cx)) / 2;
        const cpy = (leftPoints[i].y + (i > 0 ? leftPoints[i-1].y : cy)) / 2;
        ctx.quadraticCurveTo(leftPoints[i].x, leftPoints[i].y, cpx, cpy);
      }

      // Transition through center
      ctx.lineTo(cx, cy);

      // Draw the right side
      ctx.moveTo(cx, cy);
      for (let i = 0; i < len - 1; i++) {
        const cpx = (rightPoints[i].x + rightPoints[i+1].x) / 2;
        const cpy = (rightPoints[i].y + rightPoints[i+1].y) / 2;
        ctx.quadraticCurveTo(rightPoints[i].x, rightPoints[i].y, cpx, cpy);
      }
      const last = rightPoints[len - 1];
      ctx.lineTo(last.x, last.y);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = avg > 0.4 ? 2.5 : 1.8;
      ctx.shadowColor = color;
      ctx.shadowBlur = avg > 0.3 ? 12 : 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Center baseline dot with stronger pulse
    if (this.state === 'listening') {
      const dotSize = 4 + avg * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fill();
      
      // Outer ring for more "listening" feedback
      ctx.beginPath();
      ctx.arc(cx, cy, dotSize + 4 + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
    }
  }

  _drawPausedLine(W, H, cy) {
    const { ctx } = this;
    this.pausedPulsePhase += 0.04;
    const pulse = 0.4 + 0.3 * Math.sin(this.pausedPulsePhase);

    // Flat center line
    ctx.beginPath();
    ctx.moveTo(24, cy);
    ctx.lineTo(W - 24, cy);
    ctx.strokeStyle = `rgba(245,158,11,${pulse * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pulsing center dot
    const dotSize = 4 + 2 * Math.sin(this.pausedPulsePhase * 1.5);
    const cx = W / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245,158,11,${pulse})`;
    ctx.shadowColor = 'rgba(245,158,11,0.5)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawIdleLine(W, H, cy) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(24, cy);
    ctx.lineTo(W - 24, cy);
    ctx.strokeStyle = 'rgba(144,144,168,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  _startLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);
      const W = this._logicalW || 400;
      const H = this._logicalH || 88;
      const cy = H / 2;

      if (this.state === 'idle') {
        const { ctx } = this;
        ctx.clearRect(0, 0, W, H);
        this._drawIdleLine(W, H, cy);
        return;
      }

      const data = this._getFrequencyData();
      this._drawWaveform(data);
    };
    loop();
  }

  async stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }

  destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this._resizeObserver.disconnect();
    this.stop();
  }
}

window.WaveformVisualizer = WaveformVisualizer;
