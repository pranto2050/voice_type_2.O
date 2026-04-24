#!/usr/bin/env python3
"""
VoiceType Pro - Voice Engine
Streams speech recognition results and audio amplitude as JSON lines to stdout.
Accepts commands on stdin: START, STOP, PAUSE, RESUME, SET_LANG:<code>
"""

import sys
import json
import threading
import time
import os
import struct
import math


def emit(obj):
    """Write a JSON message to stdout and flush immediately."""
    try:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()
    except Exception:
        pass


def emit_status(msg):
    emit({"type": "status", "message": msg})


def emit_error(msg):
    emit({"type": "error", "message": msg})


def emit_transcript(text, final=True, lang="en-US", confidence=1.0):
    emit({
        "type": "transcript",
        "text": text,
        "lang": lang,
        "confidence": confidence,
        "final": final
    })


def emit_amplitude(value):
    emit({"type": "amplitude", "value": round(float(value), 4)})


class VoiceEngine:
    def __init__(self):
        self.language = "en-US"
        self.confidence_threshold = 0.6
        self.running = False
        self.paused = False
        self.recognition_thread = None
        self.amplitude_thread = None
        self.audio = None
        self.stream = None
        self.recognizer = None
        self.use_vosk = False
        self.vosk_model = None
        self.vosk_rec = None
        self.lock = threading.Lock()
        self._setup()

    def _setup(self):
        """Initialize speech recognition libraries."""
        # Try to import speech_recognition
        try:
            import speech_recognition as sr
            self.sr = sr
            self.recognizer = sr.Recognizer()
            # Improved thresholds for better quality and Bengali support
            self.recognizer.energy_threshold = 400
            self.recognizer.dynamic_energy_threshold = True
            self.recognizer.dynamic_energy_adjustment_damping = 0.15
            self.recognizer.dynamic_energy_ratio = 1.5
            self.recognizer.pause_threshold = 1.2  # Increased for more natural speaking
            self.recognizer.phrase_threshold = 0.15 # Even more sensitive to start
            self.recognizer.non_speaking_duration = 0.8
            emit_status("Google Speech API engine ready")
        except ImportError:
            emit_error("speech_recognition not installed. Run: pip install SpeechRecognition")
            self.recognizer = None

        # Try to import PyAudio for amplitude
        try:
            import pyaudio
            self.pyaudio = pyaudio
            self.audio = pyaudio.PyAudio()
        except ImportError:
            emit_error("PyAudio not installed. Run: pip install pyaudio")
            self.pyaudio = None

        # Try Vosk as offline fallback
        try:
            from vosk import Model, KaldiRecognizer
            model_path = os.path.join(os.path.dirname(__file__), "vosk-model")
            if os.path.exists(model_path):
                self.vosk_model = Model(model_path)
                self.use_vosk_available = True
                emit_status("Vosk offline model loaded")
            else:
                self.use_vosk_available = False
        except ImportError:
            self.use_vosk_available = False

    def set_language(self, lang_code):
        """Update the recognition language."""
        self.language = lang_code
        emit_status(f"Language set to {lang_code}")

    def set_confidence(self, threshold):
        """Update the confidence threshold."""
        try:
            self.confidence_threshold = float(threshold)
            emit_status(f"Confidence threshold set to {threshold}")
        except ValueError:
            pass

    def start(self):
        """Start recognition and amplitude threads."""
        if self.running:
            return
        self.running = True
        self.paused = False

        if self.audio and self.pyaudio:
            self.amplitude_thread = threading.Thread(target=self._amplitude_loop, daemon=True)
            self.amplitude_thread.start()

        if self.recognizer or self.use_vosk_available:
            self.recognition_thread = threading.Thread(target=self._recognition_loop, daemon=True)
            self.recognition_thread.start()

        emit_status("Recognition started")

    def stop(self):
        """Stop recognition."""
        self.running = False
        self.paused = False
        emit_amplitude(0.0)
        emit_status("Recognition stopped")

    def pause(self):
        """Pause recognition."""
        self.paused = True
        emit_amplitude(0.0)
        emit_status("Recognition paused")

    def resume(self):
        """Resume recognition."""
        self.paused = False
        emit_status("Recognition resumed")

    def _amplitude_loop(self):
        """Continuously read audio and emit amplitude values."""
        CHUNK = 1024
        FORMAT = self.pyaudio.paInt16
        CHANNELS = 1
        RATE = 16000

        try:
            stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK
            )

            while self.running:
                try:
                    if self.paused:
                        emit_amplitude(0.0)
                        time.sleep(0.05)
                        continue

                    data = stream.read(CHUNK, exception_on_overflow=False)
                    # Compute RMS amplitude
                    count = len(data) // 2
                    fmt = f"{count}h"
                    shorts = struct.unpack(fmt, data)
                    sum_squares = sum(s * s for s in shorts)
                    rms = math.sqrt(sum_squares / count) if count > 0 else 0
                    # Normalize 0-1 (16-bit audio max is 32768)
                    amplitude = min(1.0, rms / 8192.0)
                    emit_amplitude(amplitude)
                    time.sleep(0.033)  # ~30fps

                except Exception:
                    time.sleep(0.1)

            stream.stop_stream()
            stream.close()

        except Exception as e:
            emit_error(f"Amplitude stream error: {e}")

    def _recognition_loop(self):
        """Continuously listen and recognize speech."""
        if not self.recognizer and not self.use_vosk_available:
            emit_error("No recognition engine available")
            return

        import speech_recognition as sr

        with sr.Microphone(sample_rate=16000) as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
            emit_status("Microphone calibrated, listening...")

            while self.running:
                if self.paused:
                    time.sleep(0.1)
                    continue

                try:
                    audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=30)

                    if not self.running or self.paused:
                        continue

                    # Try Google first (requires internet)
                    recognized = False
                    try:
                        result = self.recognizer.recognize_google(
                            audio,
                            language=self.language,
                            show_all=True
                        )

                        if result and isinstance(result, dict):
                            alternatives = result.get("alternative", [])
                            if alternatives:
                                best = alternatives[0]
                                text = best.get("transcript", "").strip()
                                confidence = best.get("confidence", 0.9)
                                if text and confidence >= self.confidence_threshold:
                                    emit_transcript(text, final=True, lang=self.language, confidence=confidence)
                                    recognized = True

                                    # Emit lower-confidence alternatives as interim
                                    for alt in alternatives[1:3]:
                                        alt_text = alt.get("transcript", "").strip()
                                        if alt_text and alt_text != text:
                                            emit_transcript(alt_text, final=False, lang=self.language,
                                                            confidence=alt.get("confidence", 0.5))
                        elif isinstance(result, str) and result.strip():
                            emit_transcript(result.strip(), final=True, lang=self.language, confidence=0.9)
                            recognized = True

                    except sr.UnknownValueError:
                        pass  # Nothing recognized
                    except sr.RequestError:
                        # Google API unavailable — try Vosk offline fallback
                        if self.use_vosk_available and not recognized:
                            self._try_vosk(audio)

                except sr.WaitTimeoutError:
                    pass  # No speech detected in timeout window
                except Exception as e:
                    if self.running:
                        emit_error(f"Recognition error: {e}")
                    time.sleep(0.5)

    def _try_vosk(self, audio_data):
        """Attempt offline recognition with Vosk."""
        try:
            from vosk import KaldiRecognizer
            import json as _json

            if not self.vosk_rec:
                self.vosk_rec = KaldiRecognizer(self.vosk_model, 16000)

            raw = audio_data.get_raw_data(convert_rate=16000, convert_width=2)
            self.vosk_rec.AcceptWaveform(raw)
            result = _json.loads(self.vosk_rec.Result())
            text = result.get("text", "").strip()
            if text:
                emit_transcript(text, final=True, lang=self.language, confidence=0.8)
        except Exception as e:
            emit_error(f"Vosk fallback error: {e}")

    def cleanup(self):
        """Clean up resources."""
        self.stop()
        if self.audio:
            try:
                self.audio.terminate()
            except Exception:
                pass


def stdin_reader(engine):
    """Read commands from stdin and dispatch to engine."""
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        if line == "START":
            engine.start()
        elif line == "STOP":
            engine.stop()
        elif line == "PAUSE":
            engine.pause()
        elif line == "RESUME":
            engine.resume()
        elif line.startswith("SET_LANG:"):
            lang = line[9:].strip()
            if lang:
                engine.set_language(lang)
        elif line.startswith("SET_CONFIDENCE:"):
            conf = line[15:].strip()
            if conf:
                engine.set_confidence(conf)
        else:
            emit_error(f"Unknown command: {line}")


def main():
    engine = VoiceEngine()

    # Read stdin commands in a background thread
    reader = threading.Thread(target=stdin_reader, args=(engine,), daemon=True)
    reader.start()

    emit_status("Voice engine initialized and ready")

    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        engine.cleanup()


if __name__ == "__main__":
    main()
