"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BohLogo } from "@/components/brand/boh-logo";
import { LanguageSwitcher } from "@/components/language-provider";

const links = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Demo", href: "/demo" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="b-header">
      <div className="b-wrap b-header-inner">
        <Link href="/" aria-label="BOH ERP home" onClick={() => setOpen(false)}>
          <BohLogo />
        </Link>
        <nav className="b-nav" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="b-header-actions">
          <LanguageSwitcher />
          <Link className="b-btn b-btn-dark b-header-cta" href="/contact">Book a workflow call</Link>
          <button className="b-menu-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="b-mobile-nav" onClick={() => setOpen((value) => !value)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <nav id="b-mobile-nav" className="b-wrap b-mobile-nav" aria-label="Mobile navigation" hidden={!open}>
        {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
        <Link href="/contact" onClick={() => setOpen(false)}>Book a workflow call</Link>
      </nav>
    </header>
  );
}
