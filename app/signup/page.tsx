"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BuildingOfficeIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  EnvelopeIcon, 
  LockClosedIcon, 
  UserIcon,
  EyeIcon, 
  EyeSlashIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";

const roles = [
  { value: "ORGANIZER", label: "Event Organizer", icon: "📅", color: "indigo", description: "Create and manage ticketed events" },
  { value: "VENDOR", label: "Vendor", icon: "🏪", color: "emerald", description: "Offer services for social events" },
  { value: "USER", label: "Regular User", icon: "👤", color: "amber", description: "Buy tickets and book vendors" },
];

const serviceTypes = [
  { value: "venue", label: "🏛️ Venue" },
  { value: "catering", label: "🍽️ Catering" },
  { value: "photography", label: "📸 Photography" },
  { value: "decoration", label: "🎨 Decoration" },
  { value: "makeup", label: "💄 Makeup Artist" },
  { value: "dj", label: "🎧 DJ / Music" },
  { value: "transport", label: "🚐 Transport" },
  { value: "invitation", label: "💌 Invitations" },
  { value: "fashion", label: "👗 Fashion / Attire" },
  { value: "gifts", label: "🎁 Gifts & Favors" },
];

const businessTypes = [
  { value: "event_company", label: "Event Management Company" },
  { value: "production_house", label: "Production House" },
  { value: "individual", label: "Individual Organizer" },
  { value: "agency", label: "Booking Agency" },
];

interface RegisterResponse {
  success?: boolean;
  error?: string;
  message?: string;
  requiresApproval?: boolean;
  emailSent?: boolean;
  role?: string;
  user?: unknown;
  requiresVerification?: boolean;
}

interface ResendResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  
  // Core fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("USER");
  
  // Organizer specific
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  
  // Vendor specific
  const [serviceType, setServiceType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [serviceTypeOptions, setServiceTypeOptions] =
    useState<{ value: string; label: string }[]>(serviceTypes);
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Theme management
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Load service types from the DB (admin-managed); fall back to static list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/service-types");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data.data) && data.data.length > 0) {
          setServiceTypeOptions(
            data.data.map((st: { id: string; label: string; emoji: string }) => ({
              value: st.id,
              label: `${st.emoji} ${st.label}`,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load service types:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Role-specific validation
    if (role === "ORGANIZER") {
      if (!businessName) {
        setError("Business name is required for organizers");
        setLoading(false);
        return;
      }
      if (!businessType) {
        setError("Business type is required for organizers");
        setLoading(false);
        return;
      }
    }

    if (role === "VENDOR") {
      if (!businessName) {
        setError("Business name is required for vendors");
        setLoading(false);
        return;
      }
      if (!serviceType) {
        setError("Service type is required for vendors");
        setLoading(false);
        return;
      }
      if (!location) {
        setError("Location is required for vendors");
        setLoading(false);
        return;
      }
    }

    const payload = {
      name,
      email,
      password,
      role,
      ...(role === "ORGANIZER" && { businessName, businessType, phone }),
      ...(role === "VENDOR" && { businessName, serviceType, location, phone, description }),
    };

    try {
      const data = await api.post<RegisterResponse>('/api/auth/register', payload);
      
      setRequiresApproval(data.requiresApproval || false);
      setEmailSent(data.emailSent || false);
      setUserRole(data.role || role);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      await api.post<ResendResponse>('/api/auth/resend-verification', { email });
      alert("Verification email resent! Please check your inbox.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Success Screen
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full"
        >
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Check Your Email</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            We&apos;ve sent a verification email to <strong className="text-gray-700 dark:text-gray-300">{email}</strong>.
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Please check your inbox and click the verification link to activate your account.
          </p>
          
          {requiresApproval ? (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⏳ After email verification, your account will require admin approval before you can access {userRole.toLowerCase()} features.
              </p>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                ✅ After email verification, you can immediately start browsing events and buying tickets.
              </p>
            </div>
          )}

          {!emailSent && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠️ We couldn&apos;t send the email. Please check your spam folder or try resending.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Link
              href="/login"
              className="block w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-md transition-all"
            >
              Go to Login
            </Link>
            <button
              onClick={handleResendVerification}
              disabled={loading}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              {loading ? "Sending..." : "Didn't receive the email? Click to resend"}
            </button>
          </div>
          
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            The verification link will expire in 24 hours.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4 py-12 transition-colors duration-300">
      
      <Link
        href="/"
        className="fixed top-6 left-6 z-50 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 shadow-sm transition-colors border border-gray-200 dark:border-gray-700"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Link>

      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 shadow-sm transition-colors border border-gray-200 dark:border-gray-700"
      >
        {theme === "light" ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg mb-4"
            >
              <SparklesIcon className="h-7 w-7 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create account</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Join EventFlow today</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 p-3"
            >
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                I want to register as
              </label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRole(r.value);
                      setStep(2);
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      role === r.value
                        ? `border-${r.color}-500 bg-${r.color}-50 dark:bg-${r.color}-900/30`
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{r.icon}</div>
                    <p className={`text-xs font-medium ${role === r.value ? `text-${r.color}-700 dark:text-${r.color}-400` : "text-gray-600 dark:text-gray-400"}`}>
                      {r.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {(role === "ORGANIZER" || role === "VENDOR" || role === "USER") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {(role === "ORGANIZER" || role === "VENDOR") && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business name</label>
                      <div className="relative">
                        <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                          placeholder="Your business name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone number</label>
                      <div className="relative">
                        <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                          placeholder="98XXXXXXXX"
                        />
                      </div>
                    </div>
                  </>
                )}

                {role === "ORGANIZER" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business type</label>
                    <select
                      required
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                    >
                      <option value="">Select business type</option>
                      {businessTypes.map((bt) => (
                        <option key={bt.value} value={bt.value}>{bt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {role === "VENDOR" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Service type</label>
                      <select
                        required
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      >
                        <option value="">Select service type</option>
                        {serviceTypeOptions.map((st) => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Location</label>
                      <div className="relative">
                        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                          placeholder="Pokhara, Kathmandu, etc."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                        placeholder="Tell customers about your services..."
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-10 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm password</label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-10 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRightIcon className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  By creating an account, you agree to our Terms of Service and Privacy Policy
                </p>
              </motion.div>
            )}
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
            Sign in here
          </Link>
        </p>
      </motion.div>
    </div>
  )   
}