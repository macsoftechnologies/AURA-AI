import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  User,
  ShieldCheck,
  Layers,
  Globe,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { TOKEN_KEY } from "../App";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Welcome() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GPU-accelerated 3D tilt & specular glare motion values
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const smoothX = useSpring(mouseX, { stiffness: 180, damping: 24, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 180, damping: 24, mass: 0.5 });

  const rotateX = useTransform(smoothY, [0, 1], [4.5, -4.5]);
  const rotateY = useTransform(smoothX, [0, 1], [-4.5, 4.5]);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const handleCardMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  useEffect(() => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (!existingToken) return;

    const controller = new AbortController();

    async function checkExistingSession() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${existingToken}`,
          },
          signal: controller.signal,
        });

        if (response.ok) {
          navigate("/chat", { replace: true });
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    void checkExistingSession();
    return () => controller.abort();
  }, [navigate]);

  const extractErrorMessage = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") return data.detail;
      if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
        const loc = Array.isArray(data.detail[0].loc)
          ? data.detail[0].loc[data.detail[0].loc.length - 1]
          : "";
        return loc ? `${loc}: ${data.detail[0].msg}` : data.detail[0].msg;
      }
      if (typeof data?.message === "string") return data.message;
    } catch {
      // Ignore parse errors
    }
    return fallback;
  };

  const loginUser = async (userEmail: string, userPassword: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail.trim(),
        password: userPassword,
      }),
    });

    if (!response.ok) {
      const errMsg = await extractErrorMessage(
        response,
        "Invalid email or password.",
      );
      throw new Error(errMsg);
    }

    const data = await response.json();
    if (!data?.access_token) {
      throw new Error(
        "Authentication succeeded, but no access token was returned.",
      );
    }

    localStorage.setItem(TOKEN_KEY, data.access_token);
    navigate("/chat", { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim();
    const resolvedName =
      fullName.trim() || normalizedEmail.split("@")[0] || "AURA User";

    if (isRegister && password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        const registerResponse = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: resolvedName,
            full_name: resolvedName,
            username: resolvedName,
            email: normalizedEmail,
            password,
          }),
        });

        if (!registerResponse.ok) {
          const errMsg = await extractErrorMessage(
            registerResponse,
            "Unable to create your account. Please try again.",
          );
          throw new Error(errMsg);
        }

        const registerData = await registerResponse.json().catch(() => null);

        if (registerData?.access_token) {
          localStorage.setItem(TOKEN_KEY, registerData.access_token);
          navigate("/chat", { replace: true });
          return;
        }

        await loginUser(normalizedEmail, password);
      } else {
        await loginUser(normalizedEmail, password);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        setMessage(
          "Cannot reach AURA server. Make sure the backend is running.",
        );
      } else if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (registerMode: boolean) => {
    if (registerMode === isRegister) return;
    setIsRegister(registerMode);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
  };

  return (
    <div className="aura-welcome-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; background: #f4f7fb; color: #0f172a; }

        .aura-welcome-root {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background:
            radial-gradient(ellipse 70% 50% at 15% 10%, rgba(37, 99, 235, 0.14), transparent 60%),
            radial-gradient(ellipse 65% 55% at 88% 85%, rgba(14, 165, 233, 0.16), transparent 60%),
            radial-gradient(ellipse 50% 45% at 50% 50%, rgba(99, 102, 241, 0.06), transparent 70%),
            #f4f7fb;
          color: #0f172a;
          padding: 20px 24px 48px;
          perspective: 1400px;
        }

        .aura-grid-overlay {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(rgba(37, 99, 235, 0.16) 1px, transparent 1px),
            linear-gradient(to right, rgba(37, 99, 235, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.03) 1px, transparent 1px);
          background-size: 36px 36px, 72px 72px, 72px 72px;
          mask-image: radial-gradient(ellipse 85% 80% at 50% 45%, black 40%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 85% 80% at 50% 45%, black 40%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }

        .aura-ambient-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(85px);
          pointer-events: none;
          z-index: 0;
          will-change: transform;
        }

        /* CLEAN FLOATING GLASS HEADER */
        .aura-floating-nav {
          position: relative;
          z-index: 20;
          max-width: 1200px;
          margin: 0 auto;
          padding: 13px 24px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(22px) saturate(180%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow:
            0 12px 36px -8px rgba(15, 23, 42, 0.06),
            0 0 0 1px rgba(37, 99, 235, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .aura-nav-brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .aura-nav-logo {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #0284c7 100%);
          color: #ffffff;
          display: grid;
          place-items: center;
          box-shadow:
            0 8px 20px rgba(37, 99, 235, 0.32),
            inset 0 1px 1px rgba(255, 255, 255, 0.45);
          overflow: hidden;
        }

        .aura-nav-logo::after {
          content: "";
          position: absolute;
          inset: -50%;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%);
          animation: sheenSweep 4.5s infinite ease-in-out;
        }

        .aura-nav-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 16.5px;
          letter-spacing: 0.09em;
          color: #0f172a;
        }

        .aura-nav-sub {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #64748b;
          margin-top: 2px;
        }

        /* HERO STAGE */
        .aura-hero-container {
          position: relative;
          z-index: 5;
          max-width: 1200px;
          margin: 42px auto 0;
        }

        .aura-hero-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 52px;
          align-items: center;
        }

        .aura-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 15px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(37, 99, 235, 0.2);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.07);
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.13em;
          margin-bottom: 22px;
        }

        .aura-hero-h1 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(40px, 4.8vw, 62px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: #0f172a;
          margin: 0 0 20px;
        }

        .aura-gradient-shimmer {
          background: linear-gradient(
            110deg,
            #1e40af 0%,
            #2563eb 35%,
            #38bdf8 50%,
            #2563eb 65%,
            #1e40af 100%
          );
          background-size: 220% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: textShimmer 5s linear infinite;
        }

        .aura-hero-desc {
          font-size: 16px;
          line-height: 1.75;
          color: #475569;
          max-width: 520px;
          margin: 0 0 34px;
        }

        /* SCULPTURAL GYROSCOPIC ORB */
        .aura-orb-stage {
          position: relative;
          width: 148px;
          height: 148px;
          display: grid;
          place-items: center;
          margin-left: 10px;
        }

        .aura-orb-halo {
          position: absolute;
          inset: -16px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.28), transparent 70%);
          filter: blur(16px);
        }

        .aura-orb-orbit-outer {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1.5px dashed rgba(37, 99, 235, 0.32);
        }

        .aura-orb-orbit-inner {
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          border: 1.5px solid rgba(14, 165, 233, 0.28);
          border-top-color: #2563eb;
        }

        .aura-orb-sphere {
          position: relative;
          width: 112px;
          height: 112px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.95) 0%, rgba(255,255,255,0) 24%),
            radial-gradient(circle at 35% 30%, #60a5fa 0%, #2563eb 45%, #1e3a8a 82%, #0f172a 100%);
          box-shadow:
            0 24px 52px rgba(37, 99, 235, 0.38),
            inset -10px -12px 24px rgba(15, 23, 42, 0.45),
            inset 5px 5px 16px rgba(255, 255, 255, 0.72);
          overflow: hidden;
        }

        /* 3D TILT AUTH CARD */
        .aura-auth-card {
          position: relative;
          padding: 36px;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(26px) saturate(180%);
          -webkit-backdrop-filter: blur(26px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow:
            0 30px 70px -15px rgba(15, 23, 42, 0.1),
            0 0 0 1px rgba(37, 99, 235, 0.14);
          overflow: hidden;
          transform-style: preserve-3d;
        }

        .aura-card-top-accent {
          position: absolute;
          top: 0;
          left: 12%;
          right: 12%;
          height: 3px;
          border-radius: 0 0 99px 99px;
          background: linear-gradient(90deg, transparent, #2563eb, #38bdf8, transparent);
        }

        .aura-tab-bar {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 4px;
          border-radius: 14px;
          background: #eef2f8;
          border: 1px solid rgba(148, 163, 184, 0.22);
          margin-bottom: 24px;
        }

        .aura-tab-btn {
          position: relative;
          z-index: 1;
          padding: 10px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: color 0.25s ease;
        }

        .aura-tab-indicator {
          position: absolute;
          top: 4px;
          bottom: 4px;
          width: calc(50% - 4px);
          border-radius: 10px;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.3);
        }

        .aura-field-group {
          margin-bottom: 16px;
        }

        .aura-field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .aura-field-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #334155;
        }

        .aura-input-box {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 14px;
          height: 48px;
          border-radius: 13px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .aura-input-box:focus-within {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
          transform: translateY(-1px);
        }

        .aura-input-box input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          color: #0f172a;
          font-size: 14px;
          font-weight: 500;
        }

        .aura-input-box input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .aura-eye-btn,
        .aura-forgot-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0;
        }

        .aura-eye-btn {
          color: #64748b;
          display: grid;
          place-items: center;
        }

        .aura-eye-btn:hover {
          color: #2563eb;
        }

        .aura-forgot-btn {
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
        }

        .aura-forgot-btn:hover {
          text-decoration: underline;
        }

        .aura-status-msg {
          padding: 11px 14px;
          border-radius: 12px;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.22);
          color: #1e40af;
          font-size: 12.5px;
          font-weight: 600;
          margin-bottom: 14px;
        }

        .aura-submit-btn {
          position: relative;
          width: 100%;
          height: 50px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #0284c7 100%);
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          cursor: pointer;
          overflow: hidden;
          box-shadow:
            0 16px 32px -6px rgba(37, 99, 235, 0.36),
            inset 0 1px 1px rgba(255, 255, 255, 0.35);
          transition: filter 0.2s ease;
        }

        .aura-submit-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: skewX(-20deg);
          animation: btnSheen 3.8s infinite ease-in-out;
        }

        .aura-submit-btn:hover:not(:disabled) {
          filter: brightness(1.06);
        }

        .aura-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* 4 A-U-R-A INTERACTIVE PILLAR CARDS */
        .aura-pillars-grid {
          margin-top: 52px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .aura-pillar-card {
          position: relative;
          padding: 24px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow:
            0 16px 38px -10px rgba(15, 23, 42, 0.06),
            0 0 0 1px rgba(37, 99, 235, 0.11);
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.3s ease;
        }

        .aura-pillar-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #1d4ed8, #38bdf8);
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .aura-pillar-card:hover {
          box-shadow:
            0 24px 50px -12px rgba(37, 99, 235, 0.16),
            0 0 0 1px rgba(37, 99, 235, 0.28);
        }

        .aura-pillar-card:hover::before {
          opacity: 1;
        }

        .aura-pillar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .aura-pillar-badge {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(14, 165, 233, 0.12));
          border: 1px solid rgba(37, 99, 235, 0.18);
          color: #1d4ed8;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 15px;
          display: grid;
          place-items: center;
        }

        .aura-pillar-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15.5px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 7px;
        }

        .aura-pillar-desc {
          font-size: 13px;
          line-height: 1.65;
          color: #475569;
        }

        .aura-footer {
          position: relative;
          z-index: 5;
          text-align: center;
          margin-top: 44px;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.09em;
          color: #64748b;
        }

        @keyframes sheenSweep {
          0%, 60% { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%) rotate(25deg); }
        }

        @keyframes btnSheen {
          0%, 55% { left: -100%; }
          100% { left: 160%; }
        }

        @keyframes textShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 220% 50%; }
        }

        @media (max-width: 980px) {
          .aura-hero-grid { grid-template-columns: 1fr; gap: 36px; }
          .aura-pillars-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 600px) {
          .aura-pillars-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ARCHITECTURAL GRID & AMBIENT DEPTH BLOBS */}
      <div className="aura-grid-overlay" />
      <motion.div
        className="aura-ambient-blob"
        animate={{ x: [0, 45, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{
          top: "-12%",
          left: "4%",
          width: 480,
          height: 480,
          background: "rgba(37, 99, 235, 0.15)",
        }}
      />
      <motion.div
        className="aura-ambient-blob"
        animate={{ x: [0, -35, 0], y: [0, 35, 0], scale: [1.06, 0.95, 1.06] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        style={{
          bottom: "-14%",
          right: "5%",
          width: 520,
          height: 520,
          background: "rgba(14, 165, 233, 0.16)",
        }}
      />

      {/* CLEAN FLOATING GLASS HEADER */}
      <motion.header
        className="aura-floating-nav"
        initial={{ y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
      >
        <div className="aura-nav-brand">
          <motion.div
            className="aura-nav-logo"
            whileHover={{ rotate: 10, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
          >
            <Sparkles size={19} />
          </motion.div>
          <div>
            <div className="aura-nav-title">AURA</div>
            <div className="aura-nav-sub">ADAPTIVE UNIFIED RESPONSE</div>
          </div>
        </div>
      </motion.header>

      {/* HERO + 3D TILT AUTH STAGE */}
      <main className="aura-hero-container">
        <div className="aura-hero-grid">
          {/* LEFT HERO SHOWCASE */}
          <div>
            <motion.div
              className="aura-hero-eyebrow"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease: EASE_OUT_EXPO }}
            >
              <Activity size={13} />
              THE FUTURE OF PERSONAL AI
            </motion.div>

            {/* MASKED EDITORIAL HEADLINE REVEAL */}
            <h1 className="aura-hero-h1">
              <div style={{ overflow: "hidden" }}>
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.14,
                    ease: EASE_OUT_EXPO,
                  }}
                >
                  Meet <span className="aura-gradient-shimmer">AURA</span>
                </motion.div>
              </div>
              <div style={{ overflow: "hidden" }}>
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.22,
                    ease: EASE_OUT_EXPO,
                  }}
                >
                  Your Intelligent
                </motion.div>
              </div>
              <div style={{ overflow: "hidden" }}>
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.3,
                    ease: EASE_OUT_EXPO,
                  }}
                >
                  AI Assistant
                </motion.div>
              </div>
            </h1>

            <motion.p
              className="aura-hero-desc"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.36, ease: EASE_OUT_EXPO }}
            >
              Speak naturally or type seamlessly. Powered by real-time speech
              recognition, ultra-fast reasoning, and lifelike voice synthesis in
              one unified workspace.
            </motion.p>

            {/* SCULPTURAL GYROSCOPIC ORB */}
            <motion.div
              className="aura-orb-stage"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.85, delay: 0.42, ease: EASE_OUT_EXPO }}
            >
              <motion.div
                className="aura-orb-halo"
                animate={{
                  scale: [0.95, 1.18, 0.95],
                  opacity: [0.65, 1, 0.65],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="aura-orb-orbit-outer"
                animate={{ rotate: 360 }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="aura-orb-orbit-inner"
                animate={{ rotate: -360 }}
                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="aura-orb-sphere"
                animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          </div>

          {/* RIGHT 3D TILT GLASS AUTH CARD */}
          <motion.div
            ref={cardRef}
            className="aura-auth-card"
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={{ rotateX, rotateY }}
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.28, ease: EASE_OUT_EXPO }}
          >
            <div className="aura-card-top-accent" />

            {/* SLIDING PILL TAB SWITCHER */}
            <div className="aura-tab-bar">
              <motion.div
                className="aura-tab-indicator"
                animate={{ left: isRegister ? "calc(50%)" : "4px" }}
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
              <button
                type="button"
                className="aura-tab-btn"
                onClick={() => switchMode(false)}
                style={{ color: !isRegister ? "#ffffff" : "#475569" }}
              >
                Sign In
              </button>
              <button
                type="button"
                className="aura-tab-btn"
                onClick={() => switchMode(true)}
                style={{ color: isRegister ? "#ffffff" : "#475569" }}
              >
                Create Account
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? "register-head" : "login-head"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <h2
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    margin: "0 0 6px",
                    color: "#0f172a",
                  }}
                >
                  {isRegister
                    ? "Start your AURA journey"
                    : "Welcome back to AURA"}
                </h2>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "#64748b",
                    margin: "0 0 22px",
                  }}
                >
                  {isRegister
                    ? "Create your account to unlock voice & AI workspace."
                    : "Sign in to continue your experience."}
                </p>
              </motion.div>
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <AnimatePresence initial={false}>
                {isRegister && (
                  <motion.div
                    className="aura-field-group"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
                    style={{ overflow: "hidden" }}
                  >
                    <label className="aura-field-label" htmlFor="full-name">
                      Full name
                    </label>
                    <div className="aura-input-box" style={{ marginTop: 6 }}>
                      <User size={16} color="#2563eb" />
                      <input
                        id="full-name"
                        type="text"
                        placeholder="Bhuvanesh"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="aura-field-group">
                <label className="aura-field-label" htmlFor="email">
                  Email address
                </label>
                <div className="aura-input-box" style={{ marginTop: 6 }}>
                  <Mail size={16} color="#2563eb" />
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="aura-field-group">
                <div className="aura-field-header">
                  <label className="aura-field-label" htmlFor="password">
                    Password
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      className="aura-forgot-btn"
                      onClick={() =>
                        setMessage(
                          "Password recovery is not configured yet. Create a new account or contact support.",
                        )
                      }
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="aura-input-box">
                  <LockKeyhole size={16} color="#2563eb" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    minLength={8}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="aura-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isRegister && (
                  <motion.div
                    className="aura-field-group"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
                    style={{ overflow: "hidden" }}
                  >
                    <label
                      className="aura-field-label"
                      htmlFor="confirm-password"
                    >
                      Confirm password
                    </label>
                    <div className="aura-input-box" style={{ marginTop: 6 }}>
                      <LockKeyhole size={16} color="#2563eb" />
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {message && (
                <motion.div
                  className="aura-status-msg"
                  role="status"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {message}
                </motion.div>
              )}

              <motion.button
                type="submit"
                className="aura-submit-btn"
                disabled={isSubmitting}
                whileHover={
                  isSubmitting ? undefined : { scale: 1.015, y: -1.5 }
                }
                whileTap={isSubmitting ? undefined : { scale: 0.985 }}
              >
                <span>
                  {isSubmitting
                    ? isRegister
                      ? "Creating account..."
                      : "Signing in..."
                    : isRegister
                      ? "Create Account & Launch"
                      : "Continue to Workspace"}
                </span>
                <ArrowRight size={17} />
              </motion.button>
            </form>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                fontSize: 12,
                fontWeight: 500,
                color: "#64748b",
              }}
            >
              <ShieldCheck size={14} color="#2563eb" />
              Your account security matters to us.
            </div>
          </motion.div>
        </div>

        {/* 4 A-U-R-A INTERACTIVE PILLAR CARDS */}
        <div className="aura-pillars-grid">
          {[
            {
              letter: "A",
              title: "Adaptive Intelligence",
              desc: "Context-aware responses tailored to your workflow.",
              icon: Sparkles,
            },
            {
              letter: "U",
              title: "Unified Multimodal",
              desc: "Switch effortlessly between typing and hands-free voice.",
              icon: Layers,
            },
            {
              letter: "R",
              title: "Real-Time Streaming",
              desc: "5-second auto-silence detection for natural dialogue.",
              icon: Globe,
            },
            {
              letter: "A",
              title: "Architecture",
              desc: "FastAPI + React + WebSockets engineered for speed.",
              icon: CheckCircle2,
            },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              className="aura-pillar-card"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.45 + idx * 0.09,
                ease: EASE_OUT_EXPO,
              }}
              whileHover={{ y: -7 }}
            >
              <div className="aura-pillar-top">
                <div className="aura-pillar-badge">{item.letter}</div>
                <item.icon size={17} color="#2563eb" />
              </div>
              <div className="aura-pillar-title">{item.title}</div>
              <div className="aura-pillar-desc">{item.desc}</div>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="aura-footer">
        © 2026 AURA AI · ADAPTIVE UNIFIED RESPONSE ARCHITECTURE
      </footer>
    </div>
  );
}

export default Welcome;
