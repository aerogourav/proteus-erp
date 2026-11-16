"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";

type Mood = "happy" | "wow" | "cheer";

/**
 * Bohle, the BOH ERP guide: a soft violet blob wearing the three brand spheres. Original character drawn for this
 * site. Decorative, so it is hidden from assistive technology; the page content carries the meaning.
 */
export function Bohle({ mood = "happy", size = 72, className }: { mood?: Mood; size?: number; className?: string }) {
  return <svg className={`bohle${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
    <ellipse className="bohle-shadow" cx="60" cy="112" rx="30" ry="5" fill="#1B1930" opacity=".14" />
    <ellipse className="bohle-foot bohle-foot-a" cx="46" cy="106" rx="12" ry="7" fill="#3B2C9C" />
    <ellipse className="bohle-foot bohle-foot-b" cx="74" cy="106" rx="12" ry="7" fill="#3B2C9C" />
    <g className="bohle-body">
      <ellipse className="bohle-arm bohle-arm-a" cx="22" cy="74" rx="8" ry="13" fill="#5B47D6" transform="rotate(24 22 74)" />
      <ellipse className="bohle-arm bohle-arm-b" cx="98" cy={mood === "cheer" ? 52 : 74} rx="8" ry="13" fill="#5B47D6" transform={mood === "cheer" ? "rotate(28 98 52)" : "rotate(-24 98 74)"} />
      <circle cx="46" cy="27" r="10" fill="#F0A93B" />
      <circle cx="75" cy="27" r="10" fill="#2FA871" />
      <circle cx="60" cy="19" r="12" fill="#E2654A" />
      <path d="M60 26 C88 26 102 48 100 72 C98 94 82 106 60 106 C38 106 22 94 20 72 C18 48 32 26 60 26 Z" fill="#6E5AE6" />
      <path d="M60 60 C76 60 86 70 85 82 C84 94 74 100 60 100 C46 100 36 94 35 82 C34 70 44 60 60 60 Z" fill="#8F7EF0" opacity=".55" />
      <g className="bohle-eyes">
        <ellipse cx="46" cy="58" rx="9" ry="10" fill="#FFFFFF" /><ellipse cx="74" cy="58" rx="9" ry="10" fill="#FFFFFF" />
        <g className="bohle-pupil">
          <circle cx="48.5" cy="59.5" r="4.6" fill="#1B1930" /><circle cx="76.5" cy="59.5" r="4.6" fill="#1B1930" />
          <circle cx="50" cy="57.5" r="1.6" fill="#FFFFFF" /><circle cx="78" cy="57.5" r="1.6" fill="#FFFFFF" />
        </g>
      </g>
      <circle cx="34" cy="72" r="5" fill="#F79A8A" opacity=".75" /><circle cx="86" cy="72" r="5" fill="#F79A8A" opacity=".75" />
      {mood === "wow" ? <ellipse cx="60" cy="78" rx="5" ry="6" fill="#1B1930" /> : <path d={mood === "cheer" ? "M50 73 Q60 90 70 73 Z" : "M51 74 Q60 84 69 74"} fill={mood === "cheer" ? "#1B1930" : "none"} stroke="#1B1930" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  </svg>;
}

// Stops along the page: which section, and the two or three words Bohle says when he gets there.
const stops = [
  { target: "#top", en: "Hi, I’m Bohle!", de: "Hi, ich bin Bohle!" },
  { target: "#film", en: "Watch this", de: "Schau mal" },
  { target: '[aria-labelledby="problem-title"]', en: "Sound familiar?", de: "Kommt bekannt vor?" },
  { target: '[aria-labelledby="demo-title"]', en: "See it work", de: "So läuft’s" },
  { target: "#offers", en: "Start here", de: "Hier starten" },
  { target: '[aria-labelledby="status-title"]', en: "What’s real", de: "Was es gibt" },
  { target: "#who-we-are", en: "The team", de: "Das Team" },
  { target: '[aria-labelledby="faq-title"]', en: "Questions?", de: "Fragen?" },
  { target: '[aria-labelledby="cta-title"]', en: "Let’s talk!", de: "Reden wir!" },
] as const;

// What Bohle says when he is tapped, in order; the last one comes with a spin.
const pokes = [
  { en: "Hey!", de: "Hey!" },
  { en: "That tickles", de: "Das kitzelt" },
  { en: "Boing!", de: "Boing!" },
  { en: "Again!", de: "Nochmal!" },
  { en: "Wheee!", de: "Juhuu!" },
] as const;

/**
 * Bohle walks along the bottom of the window as the visitor scrolls: his position is the scroll progress, the dots on
 * his trail are the page's sections, and he hops and says a couple of words when he reaches one. His eyes follow the
 * pointer, and tapping him makes him jump. Taps are read from the page, so he never blocks a button underneath him.
 */
export function BohleWalker() {
  const { locale } = useLanguage();
  const root = useRef<HTMLDivElement>(null);
  const [stop, setStop] = useState(0);
  const [walking, setWalking] = useState(false);
  const [back, setBack] = useState(false);
  const figure = useRef<HTMLDivElement>(null);
  const facing = useRef(1);
  const [poked, setPoked] = useState(0); // how many times he has been tapped
  const [said, setSaid] = useState(-1); // index into pokes while a tap line is showing, -1 for the section line
  const [startled, setStartled] = useState(false);

  useEffect(() => {
    let tops: number[] = [];
    let last = window.scrollY;
    let idle = 0;
    let frame = 0;
    const range = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const measure = () => {
      tops = stops.map((item) => { const el = document.querySelector(item.target); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
      update();
    };
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      root.current?.style.setProperty("--bohle-p", String(Math.min(1, Math.max(0, y / range()))));
      let current = 0;
      tops.forEach((top, index) => { if (y + window.innerHeight * 0.45 >= top) current = index; });
      setStop((previous) => { if (previous !== current) setSaid(-1); return current; });
      if (Math.abs(y - last) > 1) {
        setBack(y < last);
        facing.current = y < last ? -1 : 1;
        setWalking(true);
        window.clearTimeout(idle);
        idle = window.setTimeout(() => setWalking(false), 180);
      }
      last = y;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    measure();
    const settle = window.setTimeout(measure, 1200); // images and fonts shift the section positions
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", measure); window.clearTimeout(idle); window.clearTimeout(settle); window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    let frame = 0;
    let calm = 0;
    let point = { x: 0, y: 0 };
    const box = () => figure.current?.getBoundingClientRect();
    const look = () => {
      frame = 0;
      const rect = box();
      if (!rect) return;
      const dx = point.x - (rect.left + rect.width / 2);
      const dy = point.y - (rect.top + rect.height * 0.45);
      const reach = Math.max(1, Math.hypot(dx, dy));
      const pull = Math.min(1, reach / 160);
      root.current?.style.setProperty("--bohle-ex", ((dx / reach) * 3 * pull * facing.current).toFixed(2));
      root.current?.style.setProperty("--bohle-ey", ((dy / reach) * 2.4 * pull).toFixed(2));
    };
    const onMove = (event: PointerEvent) => { point = { x: event.clientX, y: event.clientY }; if (!frame) frame = window.requestAnimationFrame(look); };
    const onDown = (event: PointerEvent) => {
      const rect = box();
      if (!rect || event.clientX < rect.left - 6 || event.clientX > rect.right + 6 || event.clientY < rect.top - 6 || event.clientY > rect.bottom + 6) return;
      setPoked((count) => count + 1);
      setSaid((index) => (index + 1) % pokes.length);
      setStartled(true);
      window.clearTimeout(calm);
      calm = window.setTimeout(() => setStartled(false), 900);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerdown", onDown); window.clearTimeout(calm); window.cancelAnimationFrame(frame); };
  }, []);

  const last = stop === stops.length - 1;
  const lang = locale === "de" ? "de" : "en";
  const spin = said === pokes.length - 1;
  return <div ref={root} className={`b-walker${walking ? " is-walking" : ""}${back ? " is-back" : ""}`} aria-hidden="true" data-no-translate>
    <div className="b-walker-track">
      <div ref={figure} className="b-walker-bohle">
        <span key={`${stop}-${locale}-${poked}`} className="b-walker-say">{said >= 0 ? pokes[said][lang] : stops[stop][lang]}</span>
        {(spin || last) && <span key={`pop-${poked}-${last ? 1 : 0}`} className="b-walker-pop"><i /><i /><i /><i /><i /><i /></span>}
        <span key={`${stop}-${poked}`} className={`b-walker-hop${spin ? " is-spin" : said >= 0 ? " is-poke" : ""}`}><Bohle mood={last || spin ? "cheer" : walking || startled ? "wow" : "happy"} size={84} /></span>
      </div>
    </div>
  </div>;
}
