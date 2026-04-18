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
  /** Whether the browser supports the Web Speech API. */
  isSupported: boolean;
  /** Current interim transcript while user is speaking. */
  interimTranscript: string;
  /** Human-readable error message, or null if no error. Cleared on next start(). */
  error: string | null;
}

/**
 * Hook for browser-native speech-to-text using the Web Speech API.
 * Works in Chrome, Edge, Safari. Firefox does not support it.
 * No API key required — runs entirely client-side.
 */
export function useSpeechToText(options: SpeechToTextOptions = {}): SpeechToTextReturn {
  const {
    onInterim,
    onResult,
    onEnd,
    lang = 'en-US',
    continuous = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Keep callbacks fresh via refs
  const onInterimRef = useRef(onInterim);
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!isSupported || isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
        onInterimRef.current?.(interim);
      }
      if (final) {
        setInterimTranscript('');
        onResultRef.current?.(final);
      }
    };

    recognition.onerror = (event) => {
      // 'aborted' is expected when calling stop() — don't log it
      if (event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error);
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone access denied. Check your browser permissions.',
          'no-speech': 'No speech detected. Try again.',
          'network': 'Speech recognition needs an internet connection.',
          'audio-capture': 'No microphone found. Check your audio input device.',
          'service-not-allowed': 'Speech service not available. Try a different browser.',
        };
        setError(messages[event.error] || `Speech error: ${event.error}`);
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      onEndRef.current?.();
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, isListening, lang, continuous]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isListening, start, stop, toggle, isSupported, interimTranscript, error };
}
