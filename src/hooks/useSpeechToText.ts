'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechToTextOptions {
  /** Called with the current transcript as the user speaks (interim results). */
  onInterim?: (transcript: string) => void;
  /** Called with the final confirmed transcript when a phrase finishes. */
  onResult?: (transcript: string) => void;
  /** Called when recognition ends (whether via stop() or timeout). */
  onEnd?: () => void;
  /** Language code, default 'en-US'. */
  lang?: string;
  /** Keep listening until explicitly stopped. Default true. */
  continuous?: boolean;
}

interface SpeechToTextReturn {
  /** Whether speech recognition is currently active. */
  isListening: boolean;
  /** Start listening. No-op if already listening. */
  start: () => void;
  /** Stop listening. No-op if not listening. */
  stop: () => void;
  /** Toggle listening on/off. */
  toggle: () => void;
  /** Whether the browser supports voice input (MediaRecorder). */
  isSupported: boolean;
  /** Current interim transcript while user is speaking. */
  interimTranscript: string;
  /** Human-readable error message, or null if no error. Cleared on next start(). */
  error: string | null;
  /** Live MediaStream while recording (null otherwise). Use for audio visualization. */
  audioStream: MediaStream | null;
}

/**
 * Hook for speech-to-text using MediaRecorder + OpenAI Whisper API.
 * Works in any modern browser (Chrome, Firefox, Brave, Safari, Edge).
 * Audio is sent to /api/voice/transcribe — API key stays server-side.
 *
 * Flow: click mic → recording → click mic → transcribing → text delivered via onResult.
 */
export function useSpeechToText(options: SpeechToTextOptions = {}): SpeechToTextReturn {
  const {
    onResult,
    onEnd,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isSupported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  // Keep callbacks fresh via refs
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const transcribe = useCallback(async (audioBlob: Blob) => {
    setInterimTranscript('Transcribing…');
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Transcription failed.' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const { text } = await res.json();
      if (text) {
        onResultRef.current?.(text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed. Try again.');
    } finally {
      setInterimTranscript('');
      onEndRef.current?.();
    }
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || isListening) return;

    setError(null);
    setInterimTranscript('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setAudioStream(stream);

      // Prefer webm/opus (small files, fast upload), fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined; // let browser pick default

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setAudioStream(null);

        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];

        if (audioBlob.size > 0) {
          transcribe(audioBlob);
        } else {
          setInterimTranscript('');
          onEndRef.current?.();
        }
      };

      recorder.onerror = () => {
        setError('Recording failed. Check your microphone.');
        setIsListening(false);
        setInterimTranscript('');
        setAudioStream(null);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch (err) {
      console.warn('Microphone access error:', err);
      const messages: Record<string, string> = {
        NotAllowedError: 'Microphone access denied. Check your browser permissions.',
        NotFoundError: 'No microphone found. Check your audio input device.',
        NotReadableError: 'Microphone is in use by another application.',
      };
      const name = err instanceof DOMException ? err.name : '';
      setError(messages[name] || 'Could not access microphone.');
    }
  }, [isSupported, isListening, transcribe]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isListening, start, stop, toggle, isSupported, interimTranscript, error, audioStream };
}
