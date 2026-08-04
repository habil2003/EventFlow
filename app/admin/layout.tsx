// app/admin/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  UsersIcon,
  ClockIcon,
  HomeIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChartBarIcon,
  ArrowLeftOnRectangleIcon,
  SunIcon,
  MoonIcon,
  XCircleIcon,
  CurrencyRupeeIcon,
  UserCircleIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  TicketIcon,
  Cog6ToothIcon,
  BellIcon,
  EnvelopeIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  CreditCardIcon,
  ReceiptRefundIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Theme management
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

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarMobileOpen(false);
  }, [pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-menu-container')) {
          setUserMenuOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, router]);

  // Active link detection
  const isActiveLink = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  // Admin sidebar links
  const adminSidebarLinks = [
    {
      category: 'Main',
      items: [
        { href: '/admin', label: 'Dashboard', icon: ChartBarIcon },
        { href: '/admin/analytics', label: 'Analytics', icon: ArrowTrendingUpIcon },
        { href: '/admin/approvals', label: 'Approvals', icon: ClockIcon },
        { href: '/admin/notifications', label: 'Notifications', icon: BellIcon },
      ],
    },
    {
      category: 'Financial',
      items: [
        { href: '/admin/escrow', label: 'Escrow', icon: ShieldCheckIcon },
        { href: '/admin/payouts', label: 'Payouts', icon: CurrencyRupeeIcon },
        { href: '/admin/refunds', label: 'Refunds', icon: ReceiptRefundIcon },
        { href: '/admin/transactions', label: 'Transactions', icon: CreditCardIcon },
        { href: '/admin/commissions', label: 'Commissions', icon: ScaleIcon },
        { href: '/admin/revenue', label: 'Revenue Reports', icon: DocumentTextIcon },
      ],
    },
    {
      category: 'Management',
      items: [
        { href: '/admin/users', label: 'Users', icon: UsersIcon },
        { href: '/admin/vendors', label: 'Vendors', icon: BuildingOfficeIcon },
        { href: '/admin/organizers', label: 'Organizers', icon: UserGroupIcon },
        { href: '/admin/events', label: 'Events', icon: CalendarIcon },
        { href: '/admin/bookings', label: 'Bookings', icon: TicketIcon },
        { href: '/admin/tickets', label: 'Tickets', icon: TicketIcon },
      ],
    },
    {
      category: 'Settings',
      items: [
        { href: '/admin/settings', label: 'Platform Settings', icon: Cog6ToothIcon },
        { href: '/admin/email-templates', label: 'Email Templates', icon: EnvelopeIcon },
        { href: '/admin/profile', label: 'My Profile', icon: UserCircleIcon },
      ],
    },
  ];

  if (!mounted || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <Link href="/admin" className="flex items-center space-x-3 overflow-hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg flex-shrink-0">
              <span className="text-lg font-bold text-white">EF</span>
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                EventFlow
              </span>
            )}
          </Link>
          
          {/* Collapse button for desktop */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRightIcon className="h-5 w-5" />
            ) : (
              <ChevronLeftIcon className="h-5 w-5" />
            )}
          </button>

          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarMobileOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links with scrollable area */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto" style={{ height: 'calc(100% - 4rem)' }}>
          {adminSidebarLinks.map((category) => (
            <div key={category.category}>
              {!sidebarCollapsed && (
                <h3 className="mb-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {category.category}
                </h3>
              )}
              <div className="space-y-1">
                {category.items.map((link) => {
                  // Skip rendering if sidebar is collapsed and we want to maintain spacing
                  const isActive = isActiveLink(link.href);
                  
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all group relative ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      title={sidebarCollapsed ? link.label : ''}
                    >
                      <link.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                      {!sidebarCollapsed && (
                        <span className="truncate">{link.label}</span>
                      )}
                      {isActive && sidebarCollapsed && (
                        <span className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-indigo-600 dark:bg-indigo-400 rounded-l-lg" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/"
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Back to Home' : ''}
            >
              <HomeIcon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Back to Home</span>}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 mt-1 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Sign Out' : ''}
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} ml-0`}>
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
            {/* Left side - Mobile menu button and Logo */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarMobileOpen(!sidebarMobileOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>

              {/* Logo for mobile */}
              <Link href="/admin" className="flex items-center space-x-3 lg:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 shadow-md">
                  <span className="text-base font-bold text-white">EF</span>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  EventFlow
                </span>
              </Link>

              {/* Dynamic Page Title based on current path */}
              <div className="hidden lg:block">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                  {pathname === '/admin' 
                    ? 'Dashboard' 
                    : pathname.split('/').pop()?.replace(/-/g, ' ') || 'Admin'}
                </h1>
              </div>
            </div>

            {/* Right side - Theme toggle and User menu */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === "light" ? (
                  <MoonIcon className="h-5 w-5" />
                ) : (
                  <SunIcon className="h-5 w-5" />
                )}
              </button>

              {/* User Menu */}
              <div className="relative user-menu-container">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                    {session.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  
                  {/* User info - hidden on mobile */}
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight">
                      {session.user?.name?.split(' ')[0] || 'Admin'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight capitalize">
                      {session.user?.role?.toLowerCase()}
                    </span>
                  </div>

                  {/* Dropdown arrow */}
                  <ChevronRightIcon className={`hidden sm:block h-4 w-4 text-gray-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-90' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 animate-fade-in">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {session.user?.email}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full capitalize">
                        {session.user?.role?.toLowerCase()}
                      </span>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        href="/admin/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <UserCircleIcon className="h-4 w-4 text-gray-400" />
                        Your Profile
                      </Link>
                      <Link
                        href="/"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <HomeIcon className="h-4 w-4 text-gray-400" />
                        Back to Home
                      </Link>
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Add animation keyframes */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}