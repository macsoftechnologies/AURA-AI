import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Mic,
  MicOff,
  Plus,
  Volume2,
  VolumeX,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
  ArrowUp,
  X,
  LogOut,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TOKEN_KEY } from "../App";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const MAX_QUESTIONS = 15;
const SILENCE_DELAY = 5000;
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const SUPPORTED_LANGUAGES = [
  { code: "te-IN", label: "తెలుగు (Telugu)", flag: "🇮🇳" },
  { code: "hi-IN", label: "हिन्दी (Hindi)", flag: "🇮🇳" },
  { code: "en-IN", label: "English (IN)", flag: "🇮🇳" },
  { code: "bn-IN", label: "বাংলা (Bengali)", flag: "🇮🇳" },
  { code: "ta-IN", label: "தமிழ் (Tamil)", flag: "🇮🇳" },
  { code: "mr-IN", label: "मराठी (Marathi)", flag: "🇮🇳" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)", flag: "🇮🇳" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)", flag: "🇮🇳" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)", flag: "🇮🇳" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)", flag: "🇮🇳" },
];

type Message = {
  role: "user" | "assistant";
  content: string;
};

type DeepgramResult = {
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: {
      transcript?: string;
    }[];
  };
};

type TTSResponse = {
  audio: string;
  format: string;
  message: string;
};

function VoiceVisualizer({
  stream,
  active,
  speaking,
}: {
  stream: MediaStream | null;
  active: boolean;
  speaking: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    let animationId = 0;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const width = canvas.width;
    const height = canvas.height;

    let frequencyData = new Uint8Array(64);

    if (active && stream) {
      try {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;

        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        frequencyData = new Uint8Array(analyser.frequencyBinCount);
      } catch (error) {
        console.error("Visualizer error:", error);
      }
    }

    const barCount = 36;
    const barWidth = 5;
    const gap = 5;

    function draw() {
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      if (active && analyser) {
        analyser.getByteFrequencyData(frequencyData);
      }

      const time = performance.now() / 180;

      for (let index = 0; index < barCount; index++) {
        let value = 0.12;

        if (active && analyser) {
          const sampleIndex = Math.floor(
            (index / barCount) * frequencyData.length,
          );
          value = frequencyData[sampleIndex] / 255;
        } else if (speaking) {
          value = 0.24 + Math.abs(Math.sin(time + index * 0.55)) * 0.65;
        } else {
          value = 0.14 + Math.abs(Math.sin(time * 0.45 + index * 0.3)) * 0.1;
        }

        const barHeight = Math.max(5, value * (height - 10));

        const x =
          (width - barCount * (barWidth + gap) + gap) / 2 +
          index * (barWidth + gap);

        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(1, "#bae6fd");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      source?.disconnect();

      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, [stream, active, speaking]);

  return (
    <canvas
      ref={canvasRef}
      width={460}
      height={90}
      className="aura-live-visualizer"
    />
  );
}

function Chat() {
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [error, setError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDoc, setActiveDoc] = useState<{ id: number; filename: string; chunks: number } | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLang, setSelectedLang] = useState(SUPPORTED_LANGUAGES[0]);
  const [questionCount, setQuestionCount] = useState(0);
  const [showConversationEndedModal, setShowConversationEndedModal] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const voiceEnabledRef = useRef(true);
  const speechRequestIdRef = useRef(0);
  const questionCountRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function getAuthHeaders(includeJson = true): Record<string, string> {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {};

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    setIsUploadingDoc(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/api/rag/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Upload failed");
      }

      const data = await res.json();
      setActiveDoc({
        id: data.document_id,
        filename: file.name,
        chunks: data.chunks_indexed,
      });
    } catch (err: any) {
      setError(err.message || "Failed to process document");
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleLogout() {
    clearSilenceTimer();

    if (isListening) {
      stopListening();
    }

    stopSpeech();

    localStorage.removeItem(TOKEN_KEY);
    navigate("/", { replace: true });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading, transcript, interimTranscript]);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function scheduleSilenceDetection() {
    clearSilenceTimer();

    silenceTimerRef.current = setTimeout(() => {
      const voiceText = [transcriptRef.current, interimTranscriptRef.current]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!voiceText) return;

      silenceTimerRef.current = null;
      stopListening();


      transcriptRef.current = "";
      interimTranscriptRef.current = "";

      setTranscript("");
      setInterimTranscript("");

      void handleSend(voiceText);
    }, SILENCE_DELAY);
  }

  useEffect(() => {
    return () => {
      clearSilenceTimer();

      const recorder = recorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      socketRef.current?.close();

      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {
          // Already stopped
        }
      }

      void audioContextRef.current?.close();
    };
  }, []);

  async function unlockAudio() {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported.");
      }

      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      await context.resume();
    }

    return context;
  }

  function stopSpeech() {
    speechRequestIdRef.current++;

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // Already stopped
      }

      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    setIsSpeaking(false);
  }

  async function speakText(text: string) {
    if (!voiceEnabledRef.current || !text.trim()) return;

    const requestId = ++speechRequestIdRef.current;

    try {
      setSpeechError("");

      const context = audioContextRef.current;

      if (!context) {
        throw new Error("Audio is not initialized.");
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      const response = await fetch(`${API_URL}/api/tts/speak`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          text,
          language_code: selectedLang.code,
        }),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `TTS error: ${response.status}`);
      }

      const data: TTSResponse = await response.json();

      if (
        requestId !== speechRequestIdRef.current ||
        !voiceEnabledRef.current
      ) {
        return;
      }

      if (!data.audio) {
        throw new Error("Cartesia returned empty audio.");
      }

      const binary = atob(data.audio);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await context.decodeAudioData(bytes.buffer.slice(0));

      if (
        requestId !== speechRequestIdRef.current ||
        !voiceEnabledRef.current
      ) {
        return;
      }

      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {
          // Already stopped
        }

        audioSourceRef.current.disconnect();
      }

      const source = context.createBufferSource();

      source.buffer = audioBuffer;
      source.connect(context.destination);

      audioSourceRef.current = source;

      source.onended = () => {
        if (audioSourceRef.current === source) {
          audioSourceRef.current = null;
          setIsSpeaking(false);
        }
      };

      source.start(0);
      setIsSpeaking(true);
    } catch (err) {
      console.error("Cartesia playback error:", err);

      if (requestId === speechRequestIdRef.current) {
        setIsSpeaking(false);

        setSpeechError(
          err instanceof Error
            ? err.message
            : "Unable to play AURA's voice response.",
        );
      }
    }
  }

  async function playAudioBase64(base64Audio: string) {
    try {
      const context = await unlockAudio();
      stopSpeech();

      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await context.decodeAudioData(bytes.buffer.slice(0));
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);

      audioSourceRef.current = source;
      source.onended = () => {
        if (audioSourceRef.current === source) {
          audioSourceRef.current = null;
          setIsSpeaking(false);
        }
      };

      source.start(0);
      setIsSpeaking(true);
    } catch (err) {
      console.error("Audio playback error:", err);
      setIsSpeaking(false);
    }
  }

  function toggleVoice() {
    const nextValue = !voiceEnabledRef.current;

    voiceEnabledRef.current = nextValue;
    setIsVoiceEnabled(nextValue);

    if (!nextValue) {
      stopSpeech();
      setSpeechError("");
    }
  }

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? message).trim();

    if (!text || loading) return;

    if (questionCountRef.current >= MAX_QUESTIONS) {
      setShowConversationEndedModal(true);
      return;
    }

    clearSilenceTimer();

    setError("");
    setSpeechError("");

    let context: AudioContext | null = null;

    try {
      context = await unlockAudio();
    } catch (err) {
      console.error("Audio initialization:", err);

      setSpeechError(
        "Browser audio could not be initialized. Check browser permissions.",
      );
    }

    stopSpeech();

    const conversationHistory = messages;

    questionCountRef.current += 1;
    setQuestionCount(questionCountRef.current);

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: text,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      let assistantResponse = "";

      if (activeDoc) {
        // Grounded Multilingual Hybrid RAG Query
        const response = await fetch(`${API_URL}/api/rag/query`, {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            query: text,
            document_id: activeDoc.id,
            language_code: selectedLang.code,
            with_voice: true,
          }),
        });

        if (response.status === 401) {
          handleLogout();
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || `RAG error: ${response.status}`);
        }

        const data = await response.json();
        assistantResponse = data.answer || "I couldn't find an answer in the document.";

        // If backend returned pre-synthesized TTS audio, play it directly
        if (voiceEnabledRef.current && data.audio) {
          playAudioBase64(data.audio);
        } else if (voiceEnabledRef.current && context) {
          void speakText(assistantResponse);
        }
      } else {
        // Standard Chat
        const response = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            message: text,
            history: conversationHistory,
          }),
        });

        if (response.status === 401) {
          handleLogout();
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || `Chat error: ${response.status}`);
        }

        const data = await response.json();
        assistantResponse =
          data.response || "I couldn't generate a response.";

        if (voiceEnabledRef.current && context) {
          void speakText(assistantResponse);
        }
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: assistantResponse,
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);

      questionCountRef.current = Math.max(0, questionCountRef.current - 1);
      setQuestionCount(questionCountRef.current);

      setError(
        err instanceof Error ? err.message : "Unable to connect to AURA.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function startListening() {
    try {
      clearSilenceTimer();

      setError("");
      setSpeechError("");

      transcriptRef.current = "";
      interimTranscriptRef.current = "";

      setTranscript("");
      setInterimTranscript("");

      if (questionCountRef.current >= MAX_QUESTIONS) {
        setShowConversationEndedModal(true);
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        handleLogout();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not supported.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Real-time live speech recognition while speaking
      const SpeechRecognitionClass =
        (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = selectedLang.code;

          recognition.onresult = (event: any) => {
            let currentInterim = "";
            let currentFinal = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const text = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                currentFinal += text;
              } else {
                currentInterim += text;
              }
            }

            if (currentFinal) {
              transcriptRef.current = [transcriptRef.current, currentFinal.trim()]
                .filter(Boolean)
                .join(" ");
              setTranscript(transcriptRef.current);
              setInterimTranscript("");
            }

            if (currentInterim) {
              interimTranscriptRef.current = currentInterim.trim();
              setInterimTranscript(currentInterim.trim());
            }

            scheduleSilenceDetection();
          };

          recognition.onerror = (e: any) => {
            console.warn("SpeechRecognition error:", e);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("SpeechRecognition initialization failed:", e);
        }
      }

      let mimeType = "";

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      }

      const wsBase = API_URL.replace(/^http/, "ws");
      const socket = new WebSocket(
        `${wsBase}/ws/stt?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(selectedLang.code)}`,
      );

      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onopen = () => {
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );

        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        recorder.onstop = () => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send("STOP");
          }

          stream.getTracks().forEach((track) => track.stop());

          streamRef.current = null;
          recorderRef.current = null;
        };

        recorder.start(250);
        setIsListening(true);
      };

      socket.onmessage = (event) => {
        try {
          const data: DeepgramResult = JSON.parse(event.data);

          const recognizedText =
            data.channel?.alternatives?.[0]?.transcript?.trim();

          if (!recognizedText) return;

          if (data.is_final) {
            transcriptRef.current = [transcriptRef.current, recognizedText]
              .filter(Boolean)
              .join(" ");

            interimTranscriptRef.current = "";

            setTranscript(transcriptRef.current);
            setInterimTranscript("");
          } else {
            interimTranscriptRef.current = recognizedText;
            setInterimTranscript(recognizedText);
          }

          scheduleSilenceDetection();
        } catch (err) {
          console.error("Transcription parsing error:", err);
        }
      };

      socket.onerror = () => {
        clearSilenceTimer();
        setError("Voice connection failed. Check FastAPI and Deepgram.");
        setIsListening(false);
      };

      socket.onclose = (event) => {
        setIsListening(false);
        socketRef.current = null;

        if (event.code === 1008 || event.code === 4401) {
          handleLogout();
        }
      };
    } catch (err) {
      console.error("Microphone error:", err);

      clearSilenceTimer();

      setError(
        err instanceof Error ? err.message : "Unable to start microphone.",
      );

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setIsListening(false);
    }
  }

  function stopListening() {
    clearSilenceTimer();

    try {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    } catch {
      // already stopped
    }

    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      socketRef.current?.close();
    }

    setIsListening(false);
  }

  function useTranscript() {
    const voiceText = [transcriptRef.current, interimTranscriptRef.current]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!voiceText) return;

    clearSilenceTimer();

    setMessage((previous) =>
      previous ? `${previous} ${voiceText}` : voiceText,
    );

    transcriptRef.current = "";
    interimTranscriptRef.current = "";

    setTranscript("");
    setInterimTranscript("");

    if (isListening) {
      stopListening();
    }
  }

  function handleNewChat() {
    if (loading) return;

    if (isListening) {
      stopListening();
    }

    stopSpeech();
    clearSilenceTimer();

    questionCountRef.current = 0;
    setQuestionCount(0);

    setMessages([]);
    setMessage("");

    transcriptRef.current = "";
    interimTranscriptRef.current = "";

    setTranscript("");
    setInterimTranscript("");

    setError("");
    setSpeechError("");
    setShowConversationEndedModal(false);
  }

  const hasConversation = messages.length > 0;

  const statusText = isListening
    ? "Listening to you"
    : isSpeaking
      ? "Speaking"
      : loading
        ? "Thinking"
        : "Ready when you are";

  return (
    <motion.div
      className="aura-app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; background: #f4f7fb; color: #0f172a; }
        button, input { font: inherit; }
        button { -webkit-tap-highlight-color: transparent; }

        .aura-app {
          min-height: 100vh;
          position: relative;
          background:
            radial-gradient(ellipse 65% 50% at 15% 15%, rgba(37, 99, 235, 0.12), transparent 55%),
            radial-gradient(ellipse 60% 50% at 88% 82%, rgba(14, 165, 233, 0.14), transparent 55%),
            #f4f7fb;
          color: #0f172a;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          display: flex;
          overflow: hidden;
        }

        .aura-chat-grid-bg {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(rgba(37, 99, 235, 0.12) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }

        .aura-sidebar {
          width: 280px;
          min-width: 280px;
          height: 100vh;
          position: sticky;
          top: 0;
          padding: 22px 16px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(22px) saturate(180%);
          border-right: 1px solid rgba(37, 99, 235, 0.14);
          box-shadow: 10px 0 36px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          z-index: 20;
          transition: width .3s cubic-bezier(.16,1,.3,1), min-width .3s cubic-bezier(.16,1,.3,1), padding .3s ease;
        }

        .aura-sidebar.closed {
          width: 78px;
          min-width: 78px;
          padding: 22px 12px;
        }

        .aura-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 6px;
          margin-bottom: 28px;
          white-space: nowrap;
        }

        .aura-brand-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #0284c7 100%);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
          flex-shrink: 0;
        }

        .aura-brand-name {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16.5px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #0f172a;
        }

        .aura-brand-subtitle {
          font-size: 9.5px;
          color: #64748b;
          font-weight: 700;
          margin-top: 2px;
          letter-spacing: 0.13em;
        }

        .aura-new-chat {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          padding: 12px 14px;
          color: #ffffff;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #0284c7 100%);
          border: none;
          border-radius: 13px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 12px 26px rgba(37, 99, 235, 0.25);
          transition: transform .2s ease, filter .2s ease;
          white-space: nowrap;
          overflow: hidden;
        }

        .aura-new-chat:hover:not(:disabled) {
          filter: brightness(1.06);
          transform: translateY(-1px);
        }

        .aura-new-chat:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .aura-sidebar-label {
          color: #64748b;
          font-size: 10px;
          letter-spacing: 0.13em;
          font-weight: 700;
          margin: 28px 8px 10px;
        }

        .aura-sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          border-radius: 12px;
          white-space: nowrap;
          overflow: hidden;
        }

        .aura-sidebar-item.active {
          color: #1d4ed8;
          background: rgba(37, 99, 235, 0.09);
          border: 1px solid rgba(37, 99, 235, 0.18);
        }

        .aura-sidebar-spacer { flex: 1; }

        .aura-limit-card {
          padding: 14px;
          border: 1px solid rgba(37, 99, 235, 0.16);
          background: #f8fafc;
          border-radius: 15px;
          margin-bottom: 14px;
        }

        .aura-limit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11.5px;
          color: #475569;
          font-weight: 600;
          margin-bottom: 9px;
        }

        .aura-limit-number {
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 800;
        }

        .aura-progress {
          height: 6px;
          border-radius: 99px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .aura-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1d4ed8, #38bdf8);
          border-radius: inherit;
          transition: width .35s cubic-bezier(.16,1,.3,1);
        }

        .aura-sidebar-footer {
          border-top: 1px solid rgba(148, 163, 184, 0.22);
          padding: 14px 2px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #475569;
          font-size: 12px;
          font-weight: 600;
        }

        .aura-footer-info {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          flex: 1;
        }

        .aura-footer-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aura-logout-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 7px 10px;
          border-radius: 10px;
          border: 1px solid rgba(220, 38, 38, 0.22);
          background: rgba(239, 68, 68, 0.08);
          color: #dc2626;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s ease;
          flex-shrink: 0;
        }

        .aura-logout-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(220, 38, 38, 0.36);
        }

        .aura-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(37, 99, 235, 0.12);
          color: #1d4ed8;
          flex-shrink: 0;
        }

        .aura-main {
          flex: 1;
          min-width: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 5;
        }

        .aura-topbar {
          height: 74px;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(37, 99, 235, 0.12);
          flex-shrink: 0;
        }

        .aura-top-left,
        .aura-top-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .aura-icon-button {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #475569;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 11px;
          cursor: pointer;
          transition: .2s ease;
        }

        .aura-icon-button:hover {
          background: #eff6ff;
          border-color: rgba(37, 99, 235, 0.32);
          color: #1d4ed8;
        }

        .aura-top-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        .aura-top-subtitle {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .aura-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.18);
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 700;
        }

        .aura-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.65);
        }

        .aura-status-dot.active {
          background: #2563eb;
          box-shadow: 0 0 12px rgba(37, 99, 235, 0.85);
          animation: statusPulse 1.2s infinite;
        }

        .aura-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px 24px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          scroll-behavior: smooth;
        }

        .aura-welcome {
          width: 100%;
          max-width: 790px;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px 10px 40px;
        }

        .aura-orb-wrap {
          width: 210px;
          height: 210px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 30px;
        }

        .aura-orb-glow {
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.32), transparent 70%);
          filter: blur(20px);
          animation: glow 4s ease-in-out infinite;
        }

        .aura-orb {
          width: 146px;
          height: 146px;
          position: relative;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.92) 0%, transparent 24%),
            radial-gradient(circle at 35% 28%, #60a5fa 0%, #2563eb 45%, #1e3a8a 82%, #0f172a 100%);
          box-shadow:
            0 26px 60px rgba(37, 99, 235, 0.36),
            inset -10px -12px 24px rgba(15, 23, 42, 0.45),
            inset 6px 6px 18px rgba(255, 255, 255, 0.65);
          animation: orbFloat 5s ease-in-out infinite;
          z-index: 2;
          transition: transform .35s ease;
        }

        .aura-orb.listening {
          transform: scale(1.1);
          animation: orbListen 1.4s ease-in-out infinite;
        }

        .aura-orb.speaking {
          animation: orbSpeak .8s ease-in-out infinite;
        }

        .aura-orb-ring {
          position: absolute;
          width: 186px;
          height: 186px;
          border-radius: 50%;
          border: 1.5px dashed rgba(37, 99, 235, 0.3);
          animation: ringRotate 22s linear infinite;
        }

        .aura-orb-ring-inner {
          position: absolute;
          width: 166px;
          height: 166px;
          border-radius: 50%;
          border: 1px solid rgba(14, 165, 233, 0.35);
          border-top-color: #2563eb;
          animation: ringRotateReverse 14s linear infinite;
        }

        .aura-live-visualizer {
          display: block;
          width: 100%;
          max-width: 114px;
          height: 46px;
          margin: auto;
        }

        .aura-welcome-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(37, 99, 235, 0.2);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.07);
          color: #1d4ed8;
          font-size: 11px;
          letter-spacing: 0.13em;
          font-weight: 700;
          margin-bottom: 18px;
        }

        .aura-welcome-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(34px, 4.8vw, 50px);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 1.1;
          margin: 0;
          color: #0f172a;
        }

        .aura-welcome-description {
          color: #475569;
          font-size: 15px;
          line-height: 1.75;
          max-width: 470px;
          margin: 14px 0 30px;
        }

        .aura-suggestions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 11px;
          max-width: 660px;
        }

        .aura-suggestion {
          padding: 11px 18px;
          border-radius: 999px;
          border: 1px solid rgba(37, 99, 235, 0.18);
          color: #1e293b;
          background: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
          transition: all .22s cubic-bezier(.16,1,.3,1);
        }

        .aura-suggestion:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 12px 26px rgba(37, 99, 235, 0.26);
        }

        .aura-chat {
          width: 100%;
          max-width: 830px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding: 10px 0 32px;
        }

        .aura-message {
          display: flex;
          gap: 13px;
          align-items: flex-start;
        }

        .aura-message.user {
          flex-direction: row-reverse;
        }

        .aura-message-avatar {
          width: 35px;
          height: 35px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #ffffff;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25);
        }

        .aura-message.user .aura-message-avatar {
          background: #e2e8f0;
          color: #1e293b;
          box-shadow: none;
        }

        .aura-message-body {
          min-width: 0;
          max-width: 82%;
        }

        .aura-message-name {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin: 2px 0 6px;
        }

        .aura-message.user .aura-message-name {
          text-align: right;
        }

        .aura-message-text {
          font-size: 14.5px;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .aura-message.user .aura-message-text {
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #0284c7 100%);
          padding: 13px 18px;
          border-radius: 18px 4px 18px 18px;
          color: #ffffff;
          box-shadow: 0 14px 28px -6px rgba(37, 99, 235, 0.28);
        }

        .aura-message.assistant .aura-message-text {
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          padding: 15px 19px;
          border-radius: 4px 18px 18px 18px;
          color: #1e293b;
          box-shadow:
            0 14px 32px -8px rgba(15, 23, 42, 0.06),
            0 0 0 1px rgba(37, 99, 235, 0.12);
        }

        .aura-message-text p { margin: 0 0 10px; }
        .aura-message-text p:last-child { margin-bottom: 0; }

        .aura-message-text pre {
          background: #0f172a;
          color: #f8fafc;
          padding: 14px;
          border-radius: 12px;
          overflow-x: auto;
        }

        .aura-message-text code { color: #2563eb; font-weight: 600; }
        .aura-message-text pre code { color: #93c5fd; font-weight: 400; }

        .aura-thinking {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
        }

        .aura-thinking-dots {
          display: flex;
          gap: 4px;
        }

        .aura-thinking-dots span {
          width: 6px;
          height: 6px;
          background: #2563eb;
          border-radius: 50%;
          animation: dotBounce 1s infinite;
        }

        .aura-thinking-dots span:nth-child(2) { animation-delay: .15s; }
        .aura-thinking-dots span:nth-child(3) { animation-delay: .3s; }

        .aura-bottom {
          width: 100%;
          max-width: 850px;
          padding: 0 20px 18px;
          margin: 0 auto;
        }

        .aura-transcript {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(37, 99, 235, 0.26);
          border-radius: 16px;
          padding: 13px 16px;
          margin-bottom: 12px;
          color: #0f172a;
          font-size: 13px;
          line-height: 1.65;
          box-shadow: 0 14px 32px rgba(37, 99, 235, 0.1);
        }

        .aura-transcript-label {
          color: #2563eb;
          font-size: 10px;
          letter-spacing: 0.13em;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .aura-use-transcript {
          background: rgba(37, 99, 235, 0.1);
          border: 1px solid rgba(37, 99, 235, 0.25);
          color: #1d4ed8;
          font-weight: 700;
          padding: 7px 12px;
          border-radius: 8px;
          margin-top: 8px;
          cursor: pointer;
          font-size: 11.5px;
        }

        .aura-input-wrap {
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(20px) saturate(180%);
          border: 1.5px solid rgba(37, 99, 235, 0.18);
          border-radius: 22px;
          box-shadow:
            0 18px 42px -10px rgba(15, 23, 42, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.9);
          transition: border-color .22s ease, box-shadow .22s ease, transform .22s ease;
        }

        .aura-input-wrap:focus-within {
          border-color: #2563eb;
          box-shadow: 0 20px 46px -8px rgba(37, 99, 235, 0.18);
          transform: translateY(-1px);
        }

        .aura-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          color: #0f172a;
          font-size: 14.5px;
          padding: 10px 4px;
        }

        .aura-input::placeholder { color: #94a3b8; }

        .aura-control {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.25);
          cursor: pointer;
          flex-shrink: 0;
          transition: .2s ease;
        }

        .aura-control.voice {
          color: #475569;
          background: #f8fafc;
        }

        .aura-control.mic {
          color: #2563eb;
          background: rgba(37, 99, 235, 0.09);
          border-color: rgba(37, 99, 235, 0.2);
        }

        .aura-control.mic.active {
          color: #ffffff;
          background: #ef4444;
          border-color: #ef4444;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.38);
          animation: micPulse 1.3s infinite;
        }

        .aura-control.send {
          color: #ffffff;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          border: none;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }

        .aura-control.send:disabled {
          background: #e2e8f0;
          color: #94a3b8;
          box-shadow: none;
        }

        .aura-control:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .aura-control:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .aura-input-hint {
          color: #64748b;
          font-size: 10.5px;
          text-align: center;
          margin-top: 10px;
        }

        .aura-counter {
          color: #64748b;
          font-size: 10.5px;
          text-align: center;
          margin-top: 5px;
        }

        .aura-counter strong { color: #1d4ed8; }

        .aura-error {
          padding: 11px 14px;
          margin-bottom: 10px;
          border-radius: 12px;
          font-size: 12.5px;
          font-weight: 600;
        }

        .aura-error.chat {
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #dc2626;
        }

        .aura-error.voice {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.28);
          color: #b45309;
        }

        .aura-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
        }

        .aura-modal {
          position: relative;
          width: 100%;
          max-width: 410px;
          padding: 32px;
          border: 1px solid rgba(37, 99, 235, 0.2);
          border-radius: 26px;
          background: #ffffff;
          box-shadow: 0 30px 85px rgba(15, 23, 42, 0.22);
          text-align: center;
        }

        .aura-modal-icon {
          width: 62px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          margin: 0 auto 18px;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
        }

        .aura-modal h2 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 22px;
          color: #0f172a;
          margin: 0 0 10px;
        }

        .aura-modal p {
          color: #475569;
          font-size: 13.5px;
          line-height: 1.7;
          margin: 0 0 24px;
        }

        .aura-modal-button {
          width: 100%;
          border: 0;
          padding: 14px;
          border-radius: 13px;
          color: white;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(37, 99, 235, 0.28);
        }

        .aura-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
        }

        @keyframes orbFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes orbListen {
          0%,100% { transform: scale(1.04); }
          50% { transform: scale(1.14); }
        }

        @keyframes orbSpeak {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        @keyframes glow {
          0%,100% { opacity: .6; transform: scale(.92); }
          50% { opacity: 1; transform: scale(1.12); }
        }

        @keyframes ringRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes ringRotateReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes statusPulse {
          0%,100% { opacity: 1; }
          50% { opacity: .45; }
        }

        @keyframes dotBounce {
          0%,60%,100% { transform: translateY(0); opacity: .5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        @keyframes micPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }

        @media (max-width: 800px) {
          .aura-sidebar {
            width: 78px;
            min-width: 78px;
            padding: 20px 12px;
          }

          .aura-sidebar .aura-brand-name,
          .aura-sidebar .aura-brand-subtitle,
          .aura-sidebar .aura-new-chat span,
          .aura-sidebar .aura-sidebar-label,
          .aura-sidebar .aura-sidebar-item span,
          .aura-sidebar .aura-limit-card,
          .aura-sidebar .aura-footer-text,
          .aura-sidebar .aura-logout-btn span {
            display: none;
          }

          .aura-brand { justify-content: center; padding: 0; }
          .aura-sidebar-footer { flex-direction: column; }
          .aura-topbar { padding: 0 18px; }
        }

        @media (max-width: 560px) {
          .aura-sidebar { display: none; }
          .aura-topbar { height: 64px; padding: 0 14px; }
          .aura-message-body { max-width: 88%; }
        }
      `}</style>

      <div className="aura-chat-grid-bg" />

      {/* SIDEBAR */}
      <aside className={`aura-sidebar ${sidebarOpen ? "" : "closed"}`}>
        <div className="aura-brand">
          <div className="aura-brand-icon">
            <Sparkles size={20} />
          </div>

          {sidebarOpen && (
            <div>
              <div className="aura-brand-name">AURA AI</div>
              <div className="aura-brand-subtitle">PERSONAL ASSISTANT</div>
            </div>
          )}
        </div>

        <motion.button
          className="aura-new-chat"
          onClick={handleNewChat}
          disabled={loading}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
        >
          <Plus size={17} />
          {sidebarOpen && <span>New conversation</span>}
        </motion.button>

        {sidebarOpen && (
          <>
            <div className="aura-sidebar-label">WORKSPACE</div>

            <div className="aura-sidebar-item active">
              <MessageSquare size={16} />
              <span>Current conversation</span>
            </div>

            <div className="aura-sidebar-spacer" />

            <div className="aura-limit-card">
              <div className="aura-limit-header">
                <span>Conversation limit</span>
                <span className="aura-limit-number">
                  {questionCount}/{MAX_QUESTIONS}
                </span>
              </div>

              <div className="aura-progress">
                <div
                  className="aura-progress-fill"
                  style={{
                    width: `${(questionCount / MAX_QUESTIONS) * 100}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {!sidebarOpen && <div className="aura-sidebar-spacer" />}

        <div
          className="aura-sidebar-footer"
          style={sidebarOpen ? undefined : { flexDirection: "column" }}
        >
          <div className="aura-footer-info">
            <div className="aura-avatar">
              <Headphones size={15} />
            </div>

            {sidebarOpen && (
              <div className="aura-footer-text">
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  AURA Assistant
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  AI conversation mode
                </div>
              </div>
            )}
          </div>

          <button
            className="aura-logout-btn"
            onClick={handleLogout}
            title="Log out"
          >
            <LogOut size={14} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="aura-main">
        <header className="aura-topbar">
          <div className="aura-top-left">
            <button
              className="aura-icon-button"
              onClick={() => setSidebarOpen((previous) => !previous)}
              title="Toggle sidebar"
            >
              {sidebarOpen ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>

            <div>
              <div className="aura-top-title">AURA Assistant</div>
              <div className="aura-top-subtitle">
                Your personal AI companion
              </div>
            </div>
          </div>

          <div className="aura-top-right">
            {/* Language Selector */}
            <select
              value={selectedLang.code}
              onChange={(e) => {
                const found = SUPPORTED_LANGUAGES.find(
                  (l) => l.code === e.target.value
                );
                if (found) setSelectedLang(found);
              }}
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid rgba(203, 213, 225, 0.8)",
                color: "#1e293b",
                borderRadius: "10px",
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                outline: "none",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option
                  key={lang.code}
                  value={lang.code}
                  style={{ background: "#ffffff", color: "#1e293b" }}
                >
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>

            <div className="aura-status">
              <span
                className={`aura-status-dot ${isListening || isSpeaking ? "active" : ""
                  }`}
              />
              {statusText}
            </div>

            <button
              className="aura-logout-btn"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* CHAT CONTENT */}
        <div className="aura-content">
          {!hasConversation ? (
            <motion.section
              className="aura-welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
            >
              <div className="aura-orb-wrap">
                <div className="aura-orb-glow" />
                <div className="aura-orb-ring" />
                <div className="aura-orb-ring-inner" />

                <div
                  className={`aura-orb ${isListening ? "listening" : isSpeaking ? "speaking" : ""
                    }`}
                >
                  <VoiceVisualizer
                    stream={streamRef.current}
                    active={isListening}
                    speaking={isSpeaking}
                  />
                </div>
              </div>

              <div className="aura-welcome-eyebrow">
                <Sparkles size={12} />
                YOUR PERSONAL AI
              </div>

              <h1 className="aura-welcome-title">
                {isListening
                  ? transcript || interimTranscript || "I'm listening..."
                  : isSpeaking
                    ? "I'm speaking."
                    : loading
                      ? "Thinking..."
                      : "Hello, I'm AURA"}
              </h1>

              <p className="aura-welcome-description">
                {isListening
                  ? "Go ahead. Tell me what's on your mind."
                  : "A smarter way to think, explore, and get things done. Ask me anything or simply start talking."}
              </p>

              <div className="aura-suggestions">
                {[
                  "Explain something to me",
                  "Help me write code",
                  "Let's have a conversation",
                  "Teach me something new",
                ].map((suggestion, idx) => (
                  <motion.button
                    className="aura-suggestion"
                    key={suggestion}
                    onClick={() => setMessage(suggestion)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.16 + idx * 0.06,
                      ease: EASE_OUT_EXPO,
                    }}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.section>
          ) : (
            <section className="aura-chat">
              <AnimatePresence initial={false}>
                {messages.map((item, index) => (
                  <motion.div
                    key={index}
                    className={`aura-message ${item.role}`}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  >
                    <div className="aura-message-avatar">
                      {item.role === "assistant" ? (
                        <Sparkles size={16} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700 }}>Y</span>
                      )}
                    </div>

                    <div className="aura-message-body">
                      <div className="aura-message-name">
                        {item.role === "assistant" ? "AURA" : "YOU"}
                      </div>

                      <div className="aura-message-text">
                        {item.role === "assistant" ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.content}
                          </ReactMarkdown>
                        ) : (
                          item.content
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div
                  className="aura-thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="aura-message-avatar">
                    <Sparkles size={15} />
                  </div>

                  <span>AURA is thinking</span>

                  <div className="aura-thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </section>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="aura-bottom">
          {(transcript || interimTranscript) && (
            <motion.div
              className="aura-transcript"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="aura-transcript-label">LIVE TRANSCRIPTION</div>
              {transcript}{" "}
              <span style={{ color: "#64748b" }}>{interimTranscript}</span>
              {transcript && (
                <div>
                  <button
                    className="aura-use-transcript"
                    onClick={useTranscript}
                  >
                    Use this message
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {error && <div className="aura-error chat">{error}</div>}

          {speechError && (
            <div className="aura-error voice">
              Voice output error: {speechError}
            </div>
          )}

          {/* Active RAG Document Pill */}
          {activeDoc && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "20px",
                padding: "4px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#1d4ed8",
                marginBottom: "6px",
                alignSelf: "flex-start",
              }}
            >
              <span>📄 {activeDoc.filename} ({activeDoc.chunks} chunks indexed)</span>
              <button
                onClick={() => setActiveDoc(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "0 2px",
                  fontSize: "14px",
                  lineHeight: 1,
                }}
                title="Remove document context"
              >
                ✕
              </button>
            </div>
          )}

          <div className="aura-input-wrap">
            {/* Hidden Document File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx"
              style={{ display: "none" }}
            />

            <button
              className="aura-control voice"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploadingDoc}
              title="Upload PDF or DOCX for Document RAG"
            >
              {isUploadingDoc ? (
                <span style={{ fontSize: "13px" }}>⏳</span>
              ) : (
                <Plus size={18} />
              )}
            </button>

            <input
              className="aura-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                activeDoc
                  ? `Ask anything about ${activeDoc.filename}...`
                  : "Ask anything, or tell AURA what's on your mind..."
              }
              disabled={loading || questionCount >= MAX_QUESTIONS}
            />

            {isListening && (
              <span
                style={{
                  color: "#2563eb",
                  fontSize: 11.5,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Listening...
              </span>
            )}

            <button
              className="aura-control voice"
              onClick={toggleVoice}
              title={isVoiceEnabled ? "Mute voice" : "Enable voice"}
            >
              {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <button
              className={`aura-control mic ${isListening ? "active" : ""}`}
              onClick={isListening ? stopListening : startListening}
              disabled={loading || questionCount >= MAX_QUESTIONS}
              title={isListening ? "Stop listening" : "Speak to AURA"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              className="aura-control send"
              onClick={() => void handleSend()}
              disabled={
                loading || !message.trim() || questionCount >= MAX_QUESTIONS
              }
              title="Send message"
            >
              <ArrowUp size={19} />
            </button>
          </div>

          <div className="aura-input-hint">
            AURA can make mistakes. Verify important information.
          </div>

          <div className="aura-counter">
            Conversation questions:{" "}
            <strong>
              {questionCount}/{MAX_QUESTIONS}
            </strong>
          </div>
        </div>
      </main>

      {/* CONVERSATION LIMIT MODAL */}
      <AnimatePresence>
        {showConversationEndedModal && (
          <motion.div
            className="aura-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="aura-modal"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            >
              <button
                className="aura-icon-button aura-modal-close"
                onClick={() => setShowConversationEndedModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>

              <div className="aura-modal-icon">
                <Sparkles size={28} />
              </div>

              <h2>Let's start fresh.</h2>

              <p>
                You've reached the 15-question limit for this conversation.
                Start a new conversation with AURA to continue.
              </p>

              <button className="aura-modal-button" onClick={handleNewChat}>
                <Plus
                  size={16}
                  style={{
                    display: "inline-block",
                    verticalAlign: "middle",
                    marginRight: 7,
                  }}
                />
                Start a new conversation
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default Chat;

