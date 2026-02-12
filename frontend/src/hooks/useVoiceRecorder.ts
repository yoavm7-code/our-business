'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionEvent = Event & { results: SpeechRecognitionResultList };

interface UseVoiceRecorderOptions {
  lang?: string;
  onResult?: (text: string) => void;
  continuous?: boolean;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const onResultRef = useRef(options.onResult);
  const retriesRef = useRef(0);
  const stoppedManuallyRef = useRef(false);

  // Keep onResult ref fresh to avoid stale closures
  useEffect(() => {
    onResultRef.current = options.onResult;
  }, [options.onResult]);

  useEffect(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const stop = useCallback(() => {
    stoppedManuallyRef.current = true;
    if (recognitionRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any).stop();
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    retriesRef.current = 0;
    stoppedManuallyRef.current = false;

    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition not supported');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)();
    recognition.lang = options.lang || 'he-IL';
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = options.continuous !== false;

    let finalText = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Pick the best alternative
          final += result[0]?.transcript || '';
        } else {
          interim += result[0]?.transcript || '';
        }
      }

      if (final) {
        finalText = final;
        setTranscript(final);
        setInterimTranscript('');
        // For non-continuous mode, fire onResult immediately
        if (options.continuous === false) {
          onResultRef.current?.(final);
        }
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: Event & { error?: string }) => {
      const errType = event.error || 'unknown';

      // For 'no-speech' error, auto-retry once
      if (errType === 'no-speech' && retriesRef.current < 1 && !stoppedManuallyRef.current) {
        retriesRef.current++;
        try {
          recognition.stop();
          setTimeout(() => {
            if (!stoppedManuallyRef.current) {
              recognition.start();
            }
          }, 300);
        } catch {
          setError(errType);
          setIsListening(false);
        }
        return;
      }

      // 'aborted' is not a real error - happens when stop() is called
      if (errType === 'aborted') return;

      setError(errType);
      setIsListening(false);
    };

    recognition.onend = () => {
      // If we have a final result and we're in continuous mode, fire callback
      if (finalText && options.continuous !== false) {
        onResultRef.current?.(finalText);
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError('Could not start speech recognition');
    }
  }, [options.lang, options.continuous]);

  return { isListening, transcript, interimTranscript, isSupported, error, start, stop };
}
