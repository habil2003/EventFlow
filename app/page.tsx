"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  TicketIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CreditCardIcon,
  QrCodeIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SparklesIcon,
  MoonIcon,
  SunIcon,
  HomeIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  UsersIcon,
  StarIcon,
  PhotoIcon,
  FireIcon,
  RocketLaunchIcon,
  MusicalNoteIcon,
  CakeIcon,
  GiftIcon,
  ArrowPathIcon,
  HeartIcon
} from "@heroicons/react/24/outline";
import { FireIcon as FireSolid, HeartIcon as HeartSolid, StarIcon as StarSolid } from "@heroicons/react/24/solid";

interface Event {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  imageUrl: string | null;
  ticketTiers: { price: number }[];
}

interface Vendor {
  id: string;
  businessName: string;
  serviceType: string;
  location: string;
  imageUrl: string | null;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<Vendor[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    totalVendors: 0,
    avgRating: 4.8,
  });
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeCategory, setActiveCategory] = useState<"social" | "ticketed">("social");

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

  // Mouse move effect for parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Floating hearts animation
  const createFloatingHeart = (x: number, y: number) => {
    const newHeart = { id: Date.now(), x, y };
    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);
  };

  // Redirect logged-in users to role-specific dashboards
  useEffect(() => {
    if (session) {
      const role = session.user?.role;
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "ORGANIZER") {
        router.push("/organizer");
      } else if (role === "VENDOR") {
        router.push("/vendor");
      } else if (role === "USER") {
        router.push("/dashboard");
      }
    }
  }, [session, router]);

  // ✅ FIXED: Fetch data with proper array extraction
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Helper to safely extract array from response
        const extractEvents = (data: any): Event[] => {
          if (Array.isArray(data)) return data;
          if (data?.events && Array.isArray(data.events)) return data.events;
          return [];
        };

        const extractVendors = (data: any): Vendor[] => {
          if (Array.isArray(data)) return data;
          if (data?.vendors && Array.isArray(data.vendors)) return data.vendors;
          return [];
        };

        // Fetch events
        const eventsRes = await fetch("/api/events?limit=4");
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setFeaturedEvents(extractEvents(eventsData).slice(0, 4));
        }

        // Fetch vendors
        const vendorsRes = await fetch("/api/vendors?limit=4");
        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setFeaturedVendors(extractVendors(vendorsData).slice(0, 4));
        }

        // Fetch stats
        const statsRes = await fetch("/api/public/stats");
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Don't show marketing page for logged-in users
  if (session) {
    return null;
  }

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="inline-block h-12 w-12 rounded-full border-4 border-indigo-600 border-t-transparent"
          ></motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Loading EventFlow...
          </motion.p>
        </div>
      </div>
    );
  }

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const floatingIcons = [
    { icon: MusicalNoteIcon, delay: 0, x: "10%", y: "20%" },
    { icon: CakeIcon, delay: 1, x: "85%", y: "15%" },
    { icon: GiftIcon, delay: 2, x: "15%", y: "70%" },
    { icon: SparklesIcon, delay: 0.5, x: "90%", y: "80%" },
    { icon: FireIcon, delay: 1.5, x: "5%", y: "50%" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300 overflow-x-hidden">

      {/* Floating Hearts */}
      <AnimatePresence>
        {floatingHearts.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            animate={{ opacity: 0, scale: 0, y: -100, x: (Math.random() - 0.5) * 100 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            style={{ position: "fixed", left: heart.x, top: heart.y, zIndex: 1000, pointerEvents: "none" }}
          >
            <HeartSolid className="h-6 w-6 text-pink-500" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {floatingIcons.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 0.1, 0.1, 0],
              scale: [1, 1.2, 1.2, 1],
              x: [0, 50, -30, 0],
              y: [0, -30, 50, 0]
            }}
            transition={{
              duration: 8,
              delay: item.delay,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            style={{ position: "absolute", left: item.x, top: item.y }}
            className="text-indigo-200 dark:text-indigo-800/30"
          >
            <item.icon className="h-16 w-16" />
          </motion.div>
        ))}
      </div>

      {/* Main Content - Marketing Only */}
      <main>

        {/* Hero Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-center py-16 px-4 relative"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-4 cursor-pointer border border-indigo-200 dark:border-indigo-800"
            whileHover={{ scale: 1.05 }}
            onClick={(e) => createFloatingHeart(e.clientX, e.clientY)}
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <SparklesIcon className="mr-1.5 h-4 w-4" />
            </motion.div>
            Nepal's Premier Event Platform
          </motion.div>

          <motion.h1
            className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{ duration: 5, repeat: Infinity }}
            style={{ backgroundSize: "200% 200%" }}
          >
            Plan Your Event.{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
              Buy Tickets.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mx-auto mt-4 max-w-2xl text-base text-gray-500 dark:text-gray-400 sm:text-lg"
          >
            Nepal's first dual-module event management platform.
            Create ticketed events, book vendors, and manage everything in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="mt-6 flex justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/signup"
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-lg shadow-lg transition-all inline-flex items-center gap-2 group hover:shadow-xl"
              >
                Get Started
                <RocketLaunchIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="#how-it-works"
                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700"
              >
                Learn More
                <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Animated scroll indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          >
            <div className="h-8 w-5 rounded-full border-2 border-gray-400 flex justify-center">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-2 w-1 bg-gray-400 rounded-full mt-1"
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Two Main Categories - Redesigned without belt-like headers */}
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Social Events Card */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              whileHover={{ scale: 1.02, y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer group relative"
              onMouseEnter={() => setActiveCategory("social")}
            >
              {/* Decorative accent instead of belt */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-400 to-rose-500" />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      className="h-14 w-14 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 flex items-center justify-center mb-3"
                    >
                      <span className="text-3xl">🎉</span>
                    </motion.div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Social Events</h2>
                  </div>
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-pink-400 opacity-30"
                  >
                    <HeartSolid className="h-12 w-12" />
                  </motion.div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Plan weddings, birthday parties, religious ceremonies, and more. Find and book trusted vendors.
                </p>

                <motion.div
                  className="flex flex-wrap gap-2 mb-4"
                  animate={{ y: activeCategory === "social" ? 0 : 10 }}
                >
                  {["Weddings", "Birthday Parties", "Religious Ceremonies", "Anniversaries"].map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.05, backgroundColor: "#fce7f3" }}
                      className="px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 rounded-full text-sm cursor-pointer transition-colors"
                    >
                      {tag}
                    </motion.span>
                  ))}
                </motion.div>

                <motion.div whileHover={{ x: 5 }}>
                  <Link
                    href="/login"
                    className="inline-flex items-center text-pink-600 dark:text-pink-400 font-semibold hover:underline group"
                  >
                    Explore Vendors
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <ArrowRightIcon className="ml-1 h-4 w-4" />
                    </motion.div>
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {/* Ticketed Events Card */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              whileHover={{ scale: 1.02, y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer group relative"
              onMouseEnter={() => setActiveCategory("ticketed")}
            >
              {/* Decorative accent instead of belt */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-500" />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center mb-3"
                    >
                      <span className="text-3xl">🎟️</span>
                    </motion.div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ticketed Events</h2>
                  </div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="text-blue-400 opacity-30"
                  >
                    <TicketIcon className="h-12 w-12" />
                  </motion.div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Discover and buy tickets for concerts, workshops, seminars, and conferences.
                </p>

                <motion.div
                  className="flex flex-wrap gap-2 mb-4"
                  animate={{ y: activeCategory === "ticketed" ? 0 : 10 }}
                >
                  {["Concerts", "Workshops", "IT Seminars", "Conferences"].map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.05, backgroundColor: "#dbeafe" }}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm cursor-pointer transition-colors"
                    >
                      {tag}
                    </motion.span>
                  ))}
                </motion.div>

                <motion.div whileHover={{ x: 5 }}>
                  <Link
                    href="/login"
                    className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline group"
                  >
                    Find Events
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <ArrowRightIcon className="ml-1 h-4 w-4" />
                    </motion.div>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* How It Works Section */}
        <div id="how-it-works" className="bg-white dark:bg-gray-800 py-16 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block"
              >
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto">
                  <FireIcon className="h-8 w-8 text-indigo-600" />
                </div>
              </motion.div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">How It Works</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Simple steps to get started</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "1", title: "Choose", desc: "Select social event or ticketed event", icon: SparklesIcon, color: "from-amber-400 to-orange-500" },
                { step: "2", title: "Book / Buy", desc: "Select package or ticket tier", icon: CreditCardIcon, color: "from-emerald-400 to-green-500" },
                { step: "3", title: "Enjoy", desc: "Pay online and attend your event", icon: HeartIcon, color: "from-rose-400 to-pink-500" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 50, rotateX: -15 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="text-center group relative"
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                    className={`h-20 w-20 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-all relative`}
                  >
                    <item.icon className="h-10 w-10 text-white" />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ delay: idx * 0.5, duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center shadow-md"
                    >
                      {item.step}
                    </motion.div>
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">{item.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Featured Events Section - FIXED IMAGE DISPLAY */}
        {featuredEvents.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center justify-between mb-8"
            >
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FireIcon className="h-6 w-6 text-orange-500" />
                  Upcoming Events
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Don't miss out on these popular events</p>
              </div>
              <motion.div whileHover={{ x: 5 }}>
                <Link
                  href="/login"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  View All
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredEvents.map((event, idx) => {
                const minPrice = event.ticketTiers?.length > 0
                  ? Math.min(...event.ticketTiers.map(t => t.price))
                  : 0;
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.8, rotateY: 30 }}
                    whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1, type: "spring" }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    onHoverStart={() => setHoveredCard(event.id)}
                    onHoverEnd={() => setHoveredCard(null)}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer group h-full flex flex-col"
                  >
                    {/* Event Image - FIXED: No empty space */}
                    <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                      {event.imageUrl ? (
                        <div className="w-full">
                          <motion.img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-full h-auto max-h-56 object-contain mx-auto"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 flex items-center justify-center">
                          <PhotoIcon className="h-8 w-8 text-indigo-400" />
                        </div>
                      )}

                      {/* HOT badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-md">
                          🔥 HOT
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">{event.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                        <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                        <MapPinIcon className="h-3 w-3 ml-2 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          NPR {minPrice.toLocaleString()}
                        </span>
                        <Link
                          href="/login"
                          className="text-sm text-indigo-600 hover:underline group inline-flex items-center gap-1"
                        >
                          View Details
                          <ArrowRightIcon className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Featured Vendors Section - FIXED IMAGE DISPLAY */}
        {featuredVendors.length > 0 && (
          <div className="bg-white dark:bg-gray-800 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex items-center justify-between mb-8"
              >
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <StarIcon className="h-6 w-6 text-yellow-500" />
                    Top Rated Vendors
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">Trusted professionals for your event</p>
                </div>
                <motion.div whileHover={{ x: 5 }}>
                  <Link
                    href="/login"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    View All
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </motion.div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredVendors.map((vendor, idx) => (
                  <motion.div
                    key={vendor.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1, type: "spring" }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden cursor-pointer group border border-gray-100 dark:border-gray-700 h-full flex flex-col"
                  >
                    {/* FIXED: Vendor Image with proper aspect ratio */}
                    <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                      {vendor.imageUrl ? (
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <motion.img
                            src={vendor.imageUrl}
                            alt={vendor.businessName}
                            className="absolute inset-0 w-full h-full object-contain bg-gray-100 dark:bg-gray-800"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 flex items-center justify-center">
                          <BuildingOfficeIcon className="h-8 w-8 text-indigo-400" />
                        </div>
                      )}

                      {/* Rating badge */}
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md z-10">
                        <StarSolid className="h-3 w-3" />
                        4.9
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">{vendor.businessName}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{vendor.serviceType}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <MapPinIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{vendor.location}</span>
                      </div>
                      <div className="mt-3">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Link
                            href="/login"
                            className="inline-block w-full text-center px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm rounded-lg hover:shadow-md transition-all font-medium"
                          >
                            View Packages
                          </Link>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: UsersIcon, label: "Happy Customers", value: stats.totalUsers, suffix: "+", color: "from-blue-400 to-blue-500" },
              { icon: CalendarIcon, label: "Events Hosted", value: stats.totalEvents, suffix: "+", color: "from-green-400 to-green-500" },
              { icon: BuildingOfficeIcon, label: "Trusted Vendors", value: stats.totalVendors, suffix: "+", color: "from-purple-400 to-purple-500" },
              { icon: StarIcon, label: "Average Rating", value: stats.avgRating, suffix: "", color: "from-yellow-400 to-yellow-500" },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="group"
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className={`h-14 w-14 rounded-full bg-gradient-to-r ${stat.color} flex items-center justify-center mx-auto mb-3 shadow-md group-hover:shadow-lg transition-all`}
                >
                  <stat.icon className="h-7 w-7 text-white" />
                </motion.div>
                <motion.p
                  className="text-3xl font-bold text-gray-900 dark:text-white"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: idx * 0.1 + 0.3, type: "spring" }}
                >
                  {stat.value}{stat.suffix}
                </motion.p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Call to Action - Compact & Elegant */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 overflow-hidden"
          >
            <div className="px-6 py-8 sm:px-8 sm:py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                {/* Left side - Text */}
                <div className="text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    Ready to get started?
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Join EventFlow today — it's free!
                  </p>
                </div>

                {/* Right side - Buttons */}
                <div className="flex items-center gap-3">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition-all"
                    >
                      Create Account
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                      Sign In
                    </Link>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">EventFlow</h3>
                <ul className="mt-4 space-y-2">
                  <li><Link href="/about" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">About Us</Link></li>
                  <li><Link href="#" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">For Organizers</h3>
                <ul className="mt-4 space-y-2">
                  <li><Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Create Event</Link></li>
                  <li><Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Sell Tickets</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">For Vendors</h3>
                <ul className="mt-4 space-y-2">
                  <li><Link href="/signup" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">List Your Services</Link></li>
                  <li><Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Vendor Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Legal</h3>
                <ul className="mt-4 space-y-2">
                  <li><Link href="#" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Terms of Service</Link></li>
                  <li><Link href="#" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-400">
                © 2026 EventFlow — Nepal's Complete Event Management Solution. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}