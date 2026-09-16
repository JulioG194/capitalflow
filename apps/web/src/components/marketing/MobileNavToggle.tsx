"use client"; // needs local open/close state and a click handler for the hamburger button

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { NavLink } from "@/lib/site-config";

type MobileNavToggleProps = {
  links: NavLink[];
};

/**
 * Collapses the top nav into a hamburger menu on small screens (AC25). This is
 * the ONLY client component in the marketing feature — everything else stays a
 * Server Component so JS-disabled visitors (AC8) still get the full desktop nav
 * and every link works via plain `<a>`/`<Link>` navigation.
 */
export function MobileNavToggle({ links }: MobileNavToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        className="inline-flex items-center justify-center rounded-card p-2 text-ink"
      >
        <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
        {isOpen ? (
          <X aria-hidden="true" size={24} />
        ) : (
          <Menu aria-hidden="true" size={24} />
        )}
      </button>

      {isOpen && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full z-20 border-b border-gray-100 bg-white px-4 pb-4 shadow-sm"
        >
          <ul className="flex flex-col gap-1 pt-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-card px-2 py-2 text-sm font-medium text-ink hover:bg-brand-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-gray-100 pt-3">
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block rounded-card px-2 py-2 text-sm font-medium text-ink hover:bg-brand-50"
              >
                Log in
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                onClick={() => setIsOpen(false)}
                className="mt-2 block rounded-card bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
              >
                Sign up
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
