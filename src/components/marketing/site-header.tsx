"use client";

import { ArrowUpRight, Hexagon, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/language-provider";

const links = [
  { label: "Product", href: "/product" },
  { label: "Solutions", href: "/#solutions" },
  { label: "Vision", href: "/#vision" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="PROTEUS home" onClick={() => setOpen(false)}>
          <span className="brand-mark"><Hexagon size={23} strokeWidth={1.8} /><i /></span>
          <span className="brand-word">PROTEUS</span>
        </Link>

        <nav className={`site-nav${open ? " is-open" : ""}`} aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
          <Link className="nav-demo mobile-demo" href="/demo" onClick={() => setOpen(false)}>
            Explore Demo <ArrowUpRight size={15} />
          </Link>
        </nav>

        <LanguageSwitcher className="header-language" />
        <Link className="nav-demo desktop-demo" href="/demo">
          Explore Demo <ArrowUpRight size={15} />
        </Link>
        <button className="menu-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}
