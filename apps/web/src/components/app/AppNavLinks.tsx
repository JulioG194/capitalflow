"use client"; // usePathname for the active route; hamburger open/close on small screens

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { APP_NAV_LINKS } from "@/lib/site-config";

function linkClass(isActive: boolean): string {
  return isActive
    ? "text-sm font-semibold text-brand-600"
    : "text-sm font-medium text-ink-muted hover:text-ink";
}

function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Platform destinations for every `/app/*` page. Desktop renders a plain
 * link row; small screens collapse into a hamburger so the long simulator
 * badge and logout still fit.
 */
export function AppNavLinks() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ul className="hidden items-center gap-5 md:flex">
        {APP_NAV_LINKS.map((link) => {
          const isActive = isCurrentPath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={linkClass(isActive)}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="app-mobile-nav-panel"
          className="inline-flex items-center justify-center rounded-card p-2 text-ink"
        >
          <span className="sr-only">{isOpen ? "Cerrar menú" : "Abrir menú"}</span>
          {isOpen ? (
            <X aria-hidden="true" size={24} />
          ) : (
            <Menu aria-hidden="true" size={24} />
          )}
        </button>

        {isOpen && (
          <div
            id="app-mobile-nav-panel"
            className="absolute inset-x-0 top-full z-20 border-b border-gray-100 bg-white px-4 pb-4 shadow-sm"
          >
            <ul className="flex flex-col gap-1 pt-2">
              {APP_NAV_LINKS.map((link) => {
                const isActive = isCurrentPath(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsOpen(false)}
                      className={`block rounded-card px-2 py-2 ${linkClass(isActive)}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
