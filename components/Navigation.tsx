'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { 
  UserIcon, 
  HomeIcon, 
  TicketIcon, 
  CalendarIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  MoonIcon,
  SunIcon,
  CurrencyRupeeIcon,
  Bars3Icon,
  XMarkIcon,
  ClockIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Only hide on auth pages
  const authPages = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password'];
  const shouldHideNav = authPages.includes(pathname);

  if (!mounted || shouldHideNav) {
    return null;
  }

  const Logo = () => (
    <Link href="/" className="flex items-center space-x-3 group" onClick={() => setMobileMenuOpen(false)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg transition-all group-hover:scale-105 group-hover:shadow-xl">
        <span className="text-lg font-bold text-white">EF</span>
      </div>
      <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
        EventFlow
      </span>
    </Link>
  );

  // Logged-out users
  if (!session) {
    return (
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                {theme === "light" ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
              </button>
              <Link href="/login" className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md">
                Sign In
              </Link>
              <Link href="/signup" className="hidden sm:inline-block rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const role = session.user?.role;

  const getNavLinks = () => {
    const commonLinks = [
      { href: '/profile', label: 'Profile', icon: UserIcon },
    ];

    if (role === 'ADMIN') {
      return [
        { href: '/admin', label: 'Dashboard', icon: ChartBarIcon },
        { href: '/admin/escrow', label: 'Escrow', icon: CurrencyRupeeIcon },
        { href: '/admin/refunds', label: 'Refunds', icon: BanknotesIcon },
        { href: '/admin/approvals', label: 'Approvals', icon: ClockIcon },
        { href: '/admin/analytics', label: 'Analytics', icon: ChartBarIcon },
        ...commonLinks,
      ];
    }

    if (role === 'VENDOR') {
      return [
        { href: '/vendor', label: 'Dashboard', icon: BuildingOfficeIcon },
        { href: '/vendor/bookings', label: 'Bookings', icon: CalendarIcon },
        { href: '/vendor/packages', label: 'Packages', icon: TicketIcon },
        { href: '/vendor/payouts', label: 'Payouts', icon: CurrencyRupeeIcon },
        ...commonLinks,
      ];
    }

    if (role === 'ORGANIZER') {
      return [
        { href: '/organizer', label: 'Dashboard', icon: BuildingOfficeIcon },
        { href: '/organizer/events', label: 'Events', icon: CalendarIcon },
        { href: '/organizer/sales', label: 'Sales', icon: ChartBarIcon },
        { href: '/organizer/payouts', label: 'Payouts', icon: CurrencyRupeeIcon },
        { href: '/organizer/checkin', label: 'Check-in', icon: ClockIcon },
        ...commonLinks,
      ];
    }

    // Regular USER links
    return [
      { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
      { href: '/my-bookings', label: 'My Bookings', icon: CalendarIcon },
      { href: '/my-tickets', label: 'My Tickets', icon: TicketIcon },
      { href: '/my-refunds', label: 'My Refunds', icon: BanknotesIcon },
      { href: '/marketplace', label: 'Marketplace', icon: BuildingOfficeIcon },
      ...commonLinks,
    ];
  };

  const navLinks = getNavLinks();

  // ✅ FIXED: Active state detection
  const isActive = (href: string) => {
    if (href === '/') return pathname === href;
    
    // Dashboard routes - exact match only (don't highlight for child pages)
    const dashboardRoutes = ['/admin', '/vendor', '/organizer', '/dashboard'];
    if (dashboardRoutes.includes(href)) {
      return pathname === href;
    }
    
    // For all other routes, check if current path matches or starts with href
    // This makes /admin/refunds active for href="/admin/refunds"
    // And /admin/refunds/123 active for href="/admin/refunds"
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Logo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive(link.href)
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              {theme === "light" ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            </button>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session.user?.name?.split(' ')[0] || session.user?.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{role?.toLowerCase()}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
              >
                Sign Out
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all ${
                    isActive(link.href)
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{session.user?.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{role?.toLowerCase()}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full mt-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white text-base font-medium rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}