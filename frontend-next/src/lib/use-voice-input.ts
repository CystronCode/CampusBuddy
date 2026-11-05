"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { transcribeAudio } from "@/lib/api";

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  lang?: string;
}

export function useVoiceInput({
  onTranscript,
  onError,
  lang = "en-IN",
}: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");
  const isStoppingRef = useRef(false);

  // Initialize Web Speech recognition if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recog = new SpeechRecognition();
          recog.continuous = false;
          recog.interimResults = true;
          recog.lang = lang;

          recog.onresult = (event: any) => {
            let interim = "";
            let final = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const piece = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                final += piece;
              } else {
                interim += piece;
              }
            }
            const current = (final || interim).trim();
            if (current) {
              liveTranscriptRef.current = current;
              onTranscript(current);
            }
          };

          recog.onerror = (e: any) => {
            if (e.error !== "no-speech" && e.error !== "aborted") {
              console.warn("Speech recognition warning:", e);
            }
          };

          recog.onend = () => {
            if (isListening && !isStoppingRef.current) {
              // Stopped due to silence - finalize
              stopListening();
            }
          };

          recognitionRef.current = recog;
        } catch (err) {
          console.warn("Could not setup SpeechRecognition:", err);
        }
      }
    }
  }, [lang, onTranscript, isListening]);

  const stopListening = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setIsListening(false);

    // Stop speech recognition
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch {}

    // Stop media recorder and process audio through Whisper STT
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("MediaRecorder stop error:", err);
        cleanupStream();
      }
    } else {
      cleanupStream();
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isStoppingRef.current = false;
  }, []);

  const startListening = useCallback(async () => {
    setError("");
    liveTranscriptRef.current = "";
    audioChunksRef.current = [];
    isStoppingRef.current = false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Microphone input is not supported in this browser.";
      setError(msg);
      onError?.(msg);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Determine best audio MIME type
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioChunks = audioChunksRef.current;
        cleanupStream();

        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, {
            type: recorder.mimeType || "audio/webm",
          });

          // Only transcribe if audio has substantial content (> 1000 bytes)
          if (audioBlob.size > 1000) {
            setIsTranscribing(true);
            try {
              const result = await transcribeAudio(audioBlob);
              if (result?.text && result.text.trim()) {
                onTranscript(result.text.trim());
              }
            } catch (err) {
              console.warn("STT Whisper transcription fallback to live transcript:", err);
              if (liveTranscriptRef.current) {
                onTranscript(liveTranscriptRef.current);
              }
            } finally {
              setIsTranscribing(false);
            }
          }
        }
      };

      // Request data in chunks every 250ms
      recorder.start(250);
      setIsListening(true);

      // Start live speech recognition if available
      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (recogErr) {
        console.warn("Could not start live SpeechRecognition:", recogErr);
      }
    } catch (err: any) {
      console.error("Microphone access error:", err);
      let msg = "Could not access microphone.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Microphone access was denied. Please allow microphone permissions in your browser.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No microphone found on your device.";
      }
      setError(msg);
      onError?.(msg);
      setIsListening(false);
      cleanupStream();
    }
  }, [cleanupStream, onError, onTranscript]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isTranscribing,
    error,
    startListening,
    stopListening,
    toggleListening,
    sttModel: "Whisper Large V3 Turbo",
  };
}
