/**
 * NyouOS system interaction sounds synthesized locally with Web Audio.
 * No audio files, stereo panning, or window-position data are used here.
 */
(function () {
    'use strict';

    const CUE_GAP_MS = 120;
    const OUTPUT_BOOST = 2;
    const MAX_TONE_GAIN = 0.14;
    const patterns = Object.freeze({
        startup: [
            { frequency: 261.63, start: 0.00, duration: 0.48, gain: 0.060, type: 'sine', endFrequency: 293.66 },
            { frequency: 392.00, start: 0.08, duration: 0.54, gain: 0.052, type: 'sine', endFrequency: 440.00 },
            { frequency: 523.25, start: 0.20, duration: 0.58, gain: 0.056, type: 'sine', endFrequency: 587.33 },
            { frequency: 659.25, start: 0.34, duration: 0.50, gain: 0.040, type: 'sine' }
        ],
        shutdown: [
            { frequency: 659.25, start: 0.00, duration: 0.30, gain: 0.058, type: 'sine', endFrequency: 587.33 },
            { frequency: 493.88, start: 0.18, duration: 0.38, gain: 0.062, type: 'sine', endFrequency: 392.00 },
            { frequency: 329.63, start: 0.40, duration: 0.52, gain: 0.066, type: 'sine', endFrequency: 220.00 }
        ],
        restart: [
            { frequency: 392.00, start: 0.00, duration: 0.20, gain: 0.058, type: 'triangle', endFrequency: 440.00 },
            { frequency: 523.25, start: 0.14, duration: 0.24, gain: 0.064, type: 'sine', endFrequency: 587.33 },
            { frequency: 659.25, start: 0.29, duration: 0.28, gain: 0.066, type: 'sine', endFrequency: 783.99 },
            { frequency: 523.25, start: 0.52, duration: 0.34, gain: 0.052, type: 'sine', endFrequency: 659.25 }
        ],
        'notification-info': [
            { frequency: 659.25, start: 0.00, duration: 0.16, gain: 0.070, type: 'sine' },
            { frequency: 880.00, start: 0.10, duration: 0.24, gain: 0.058, type: 'sine' }
        ],
        'notification-success': [
            { frequency: 523.25, start: 0.00, duration: 0.14, gain: 0.064, type: 'sine' },
            { frequency: 659.25, start: 0.08, duration: 0.18, gain: 0.064, type: 'sine' },
            { frequency: 783.99, start: 0.17, duration: 0.24, gain: 0.052, type: 'sine' }
        ],
        'notification-warning': [
            { frequency: 440.00, start: 0.00, duration: 0.15, gain: 0.070, type: 'triangle' },
            { frequency: 392.00, start: 0.18, duration: 0.20, gain: 0.066, type: 'triangle' }
        ],
        'notification-error': [
            { frequency: 392.00, start: 0.00, duration: 0.17, gain: 0.068, type: 'triangle', endFrequency: 349.23 },
            { frequency: 293.66, start: 0.14, duration: 0.28, gain: 0.070, type: 'triangle', endFrequency: 246.94 }
        ],
        'dialog-info': [
            { frequency: 523.25, start: 0.00, duration: 0.16, gain: 0.062, type: 'sine' },
            { frequency: 659.25, start: 0.05, duration: 0.25, gain: 0.050, type: 'sine' }
        ],
        'dialog-success': [
            { frequency: 493.88, start: 0.00, duration: 0.14, gain: 0.062, type: 'sine' },
            { frequency: 659.25, start: 0.10, duration: 0.25, gain: 0.060, type: 'sine' }
        ],
        'dialog-warning': [
            { frequency: 415.30, start: 0.00, duration: 0.16, gain: 0.068, type: 'triangle' },
            { frequency: 415.30, start: 0.20, duration: 0.20, gain: 0.064, type: 'triangle' }
        ],
        'dialog-error': [
            { frequency: 349.23, start: 0.00, duration: 0.18, gain: 0.070, type: 'triangle' },
            { frequency: 261.63, start: 0.15, duration: 0.30, gain: 0.072, type: 'triangle' }
        ],
        'dialog-input': [
            { frequency: 440.00, start: 0.00, duration: 0.13, gain: 0.056, type: 'sine' },
            { frequency: 554.37, start: 0.07, duration: 0.20, gain: 0.048, type: 'sine' }
        ]
    });

    let context = null;
    let outputDestination = null;
    let queuedStartup = false;
    let unlockHandler = null;
    let startupProtectedUntil = 0;
    let suppressionDepth = 0;
    const activeVoices = new Set();
    const lastPlayedAt = new Map();

    function enabled() {
        return typeof State !== 'undefined'
            && State.settings?.enableSystemInteractionAudio === true
            && suppressionDepth === 0
            && getVolumeScale() > 0;
    }

    function runSilently(callback) {
        if (typeof callback !== 'function') return undefined;
        suppressionDepth += 1;
        try {
            return callback();
        } finally {
            suppressionDepth = Math.max(0, suppressionDepth - 1);
        }
    }

    function getVolumeScale() {
        const raw = typeof State !== 'undefined' ? Number(State.settings?.volume ?? 50) : 50;
        return Math.max(0, Math.min(1, (Number.isFinite(raw) ? raw : 50) / 100));
    }

    function getContext() {
        if (context) return context;
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return null;
        try {
            context = new AudioContextClass();
        } catch (_) {
            context = null;
        }
        return context;
    }

    function normalizeType(type) {
        const normalized = String(type || 'info').toLowerCase();
        return ['info', 'success', 'warning', 'error'].includes(normalized) ? normalized : 'info';
    }

    function nowMs() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

    function setAudioParam(param, value, atTime) {
        if (!param) return;
        if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, atTime);
        else param.value = value;
    }

    function getOutputDestination(audioContext) {
        if (outputDestination) return outputDestination;
        if (typeof audioContext.createDynamicsCompressor !== 'function') {
            outputDestination = audioContext.destination;
            return outputDestination;
        }

        const compressor = audioContext.createDynamicsCompressor();
        setAudioParam(compressor.threshold, -14, audioContext.currentTime);
        setAudioParam(compressor.knee, 18, audioContext.currentTime);
        setAudioParam(compressor.ratio, 5, audioContext.currentTime);
        setAudioParam(compressor.attack, 0.003, audioContext.currentTime);
        setAudioParam(compressor.release, 0.22, audioContext.currentTime);
        compressor.connect(audioContext.destination);
        outputDestination = compressor;
        return outputDestination;
    }

    function playTone(audioContext, destination, baseStartAt, tone, volumeScale) {
        const startAt = baseStartAt + tone.start;
        const endAt = startAt + tone.duration;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const voice = { oscillator, gain };
        activeVoices.add(voice);

        const releaseVoice = () => {
            activeVoices.delete(voice);
            try { oscillator.disconnect(); } catch (_) {}
            try { gain.disconnect(); } catch (_) {}
        };
        if (typeof oscillator.addEventListener === 'function') {
            oscillator.addEventListener('ended', releaseVoice, { once: true });
        } else {
            oscillator.onended = releaseVoice;
        }

        oscillator.type = tone.type || 'sine';
        oscillator.frequency.setValueAtTime(tone.frequency, startAt);
        if (tone.endFrequency && typeof oscillator.frequency.exponentialRampToValueAtTime === 'function') {
            oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, endAt);
        }

        gain.gain.setValueAtTime(0.0001, startAt);
        const boostedGain = Math.min(MAX_TONE_GAIN, tone.gain * volumeScale * OUTPUT_BOOST);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, boostedGain), startAt + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.04);
    }

    function schedule(cue, bypassGap = false) {
        if (!enabled()) return false;
        const audioContext = getContext();
        const pattern = patterns[cue];
        if (!audioContext || !pattern || audioContext.state === 'closed') return false;

        const current = nowMs();
        const lastPlayed = lastPlayedAt.get(cue);
        if (!bypassGap && lastPlayed !== undefined && current - lastPlayed < CUE_GAP_MS) return false;
        if (cue === 'startup' && audioContext.currentTime < startupProtectedUntil) return false;
        lastPlayedAt.set(cue, current);

        const volumeScale = getVolumeScale();
        const destination = getOutputDestination(audioContext);
        let baseStartAt = audioContext.currentTime + 0.018;
        if (cue !== 'startup' && startupProtectedUntil > baseStartAt) {
            baseStartAt = startupProtectedUntil + 0.025;
        }
        if (cue === 'startup') {
            const patternDuration = Math.max(...pattern.map(tone => tone.start + tone.duration));
            startupProtectedUntil = baseStartAt + patternDuration + 0.06;
        }
        pattern.forEach(tone => playTone(audioContext, destination, baseStartAt, tone, volumeScale));
        return true;
    }

    function removeUnlockListeners() {
        if (!unlockHandler || typeof globalThis.removeEventListener !== 'function') return;
        ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
            globalThis.removeEventListener(eventName, unlockHandler, true);
        });
        unlockHandler = null;
    }

    function installUnlockListeners(audioContext) {
        if (unlockHandler || typeof globalThis.addEventListener !== 'function') return;
        unlockHandler = async () => {
            try {
                await audioContext.resume();
            } catch (_) {
                return;
            }
            if (audioContext.state !== 'running') return;
            removeUnlockListeners();
            if (queuedStartup) {
                queuedStartup = false;
                schedule('startup', true);
            }
        };
        ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
            globalThis.addEventListener(eventName, unlockHandler, true);
        });
    }

    function play(cue) {
        if (!enabled() || !patterns[cue]) return false;
        const audioContext = getContext();
        if (!audioContext) return false;
        if (audioContext.state === 'running') return schedule(cue);

        if (cue === 'startup') queuedStartup = true;
        installUnlockListeners(audioContext);
        if (typeof audioContext.resume !== 'function') return false;

        Promise.resolve(audioContext.resume()).then(() => {
            if (audioContext.state !== 'running') return;
            removeUnlockListeners();
            if (cue === 'startup') queuedStartup = false;
            schedule(cue);
        }).catch(() => {});
        return true;
    }

    function playNotification(type = 'info') {
        return play(`notification-${normalizeType(type)}`);
    }

    function playDialog(type = 'info') {
        const normalized = String(type || 'info').toLowerCase();
        return play(normalized === 'input' ? 'dialog-input' : `dialog-${normalizeType(normalized)}`);
    }

    function playStartup() {
        return play('startup');
    }

    function playPower(action) {
        const normalized = String(action || '').toLowerCase();
        return normalized === 'shutdown' || normalized === 'restart' ? play(normalized) : false;
    }

    globalThis.SystemInteractionAudio = Object.freeze({
        enabled,
        play,
        playNotification,
        playDialog,
        playStartup,
        playPower,
        runSilently
    });
})();
