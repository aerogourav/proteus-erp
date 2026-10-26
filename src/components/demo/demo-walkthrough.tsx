"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, Boxes, ClipboardList, FileStack,
  Pause, Play, Route, Settings2, X,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { BohMark } from "@/components/brand/boh-logo";
import { translateText } from "@/lib/de-translations";
import styles from "@/components/demo/demo.module.css";

const stops = [
  { label: "Documents", detail: "The released drawing and the old inspection-plan revision.", href: "/demo/classic/documents", icon: FileStack, guide: "Start with the controlled drawing. Revision C is approved and linked to AP-1001." },
  { label: "Parts", detail: "The part record connects its current revision to documents.", href: "/demo/classic/parts/ap-1001", icon: Boxes, guide: "AP-1001 is on revision C. Its linked records stay together on the part." },
  { label: "Production", detail: "The order points back to the same part and revision.", href: "/demo/classic/production/mo-2026-0142", icon: ClipboardList, guide: "MO-2026-0142 is for 48 pieces of AP-1001, revision C." },
  { label: "Configuration", detail: "A configurable rule checks the required records.", href: "/demo/classic/configuration", icon: Settings2, guide: "This rule expects an approved inspection plan. The linked revision is outdated." },
  { label: "Activity", detail: "Record history explains why the order is held.", href: "/demo/classic/activity", icon: Activity, guide: "The activity trail records the drawing release and the inspection-plan warning." },
] as const;

function GuideFigure({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={className} style={style} aria-hidden="true"><BohMark size={40} smile className="boh-guide-figure" style={{ display: "block", margin: "0 auto" }} /></span>;
}

export function DemoWalkthroughLauncher() {
  const { locale } = useLanguage();
  const t = (value: string) => translateText(value, locale);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameLoading, setFrameLoading] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !playing || frameLoading) return;
    const timer = window.setTimeout(() => {
      setFrameLoading(true);
      setActive((step) => (step + 1) % stops.length);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [open, playing, frameLoading]);

  const start = () => {
    setActive(0);
    setFrameLoading(true);
    setPlaying(true);
    setOpen(true);
  };
  const close = () => {
    setPlaying(false);
    setOpen(false);
  };
  const selectStep = (index: number) => {
    setPlaying(false);
    if (index !== active) setFrameLoading(true);
    setActive(index);
  };

  const stop = stops[active];
  const progress = ((active + 0.5) / stops.length) * 100;
  const ActiveIcon = stop.icon;

  return <>
    <div className={styles.walkthroughLauncher}>
      <div className={styles.walkthroughLauncherCopy}>
        <span><Route size={14} /> {t("OPTIONAL WALKTHROUGH · SYNTHETIC RECORDS")}</span>
        <p>{t("Let BOH guide you through documents, revisions, production, and the rule behind an order warning.")}</p>
      </div>
      <button type="button" className={styles.walkthroughLaunchButton} onClick={start}>
        <Play size={15} fill="currentColor" />
        {t("See demo walkthrough")}
      </button>
    </div>

    {open && <dialog
      ref={dialogRef}
      className={styles.walkthroughDialog}
      aria-labelledby="proteus-walkthrough-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className={styles.walkthroughDialogHead}>
        <div>
          <span>{t("INTERACTIVE PRODUCT TOUR · SYNTHETIC RECORDS")}</span>
          <h2 id="proteus-walkthrough-title">{t("BOH ERP demo walkthrough")}</h2>
          <p>{t("Follow one sample order across the actual demo screens, from its engineering records to the rule that flags a missing requirement.")}</p>
        </div>
        <button ref={closeButtonRef} type="button" className={styles.walkthroughCloseButton} aria-label={t("Close walkthrough")} onClick={close}>
          <X size={18} />
        </button>
      </div>

      <div className="walkthrough-video" data-playing={playing}>
        <div className="walkthrough-appbar">
          <span className="walkthrough-brand"><i><FileStack size={14} /></i><b>BOH ERP</b></span>
          <div><span>{DEMO_COMPANY.name}</span><i /><small>{t("SYNTHETIC DEMO")}</small></div>
          <span className="walkthrough-appbar-status"><i />{t("Interactive preview")}</span>
        </div>

        <div className="walkthrough-route">
          <div className="walkthrough-route-path" aria-hidden="true">
            <span className="walkthrough-route-line" />
            <span className="walkthrough-route-progress" style={{ width: `${(active / (stops.length - 1)) * ((stops.length - 1) / stops.length) * 100}%` }} />
            <GuideFigure className="walkthrough-route-guide" style={{ left: `${progress}%` }} />
          </div>
          <nav aria-label={t("Walkthrough steps")}>
            {stops.map(({ label, icon: Icon }, index) => (
              <button key={label} type="button" className={`${index === active ? "is-current" : ""} ${index < active ? "is-complete" : ""}`} onClick={() => selectStep(index)} aria-label={`${t("Step")} ${index + 1}: ${t(label)}`} aria-pressed={active === index}>
                <span className="walkthrough-step-marker"><Icon size={13} /></span>
                <span>{t(label)}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="walkthrough-guidebar">
          <div className="walkthrough-guide-avatar"><GuideFigure /></div>
          <div className="walkthrough-speech" aria-live="polite">
            <span><b>{t("BOH · YOUR GUIDE")}</b> · {String(active + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}</span>
            <p>{t(stop.guide)}</p>
          </div>
          <button className="walkthrough-play" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? t("Pause walkthrough") : t("Play walkthrough")}>
            {playing ? <Pause size={13} /> : <Play size={13} />}{playing ? t("Pause") : t("Play")}
          </button>
        </div>

        <div className="walkthrough-frame" aria-busy={frameLoading}>
          <iframe
            key={stop.href}
            src={stop.href}
            title={`${t("Interactive BOH ERP demo")}: ${t(stop.label)}`}
            loading="eager"
            onLoad={() => setFrameLoading(false)}
            onError={() => setFrameLoading(false)}
          />
          {frameLoading && <div className="walkthrough-frame-loading" aria-hidden="true"><span className="walkthrough-loading-mark"><i /><i /><i /></span><span>{t("Opening the demo screen…")}</span></div>}
        </div>
      </div>

      <div className={styles.walkthroughDialogFoot}>
        <span><ActiveIcon size={13} /> {t(stop.label)}: {t(stop.detail)}</span>
        <Link href={stop.href} onClick={close}>{t("Open this demo area")} <ArrowRight size={14} /></Link>
      </div>
    </dialog>}
  </>;
}
