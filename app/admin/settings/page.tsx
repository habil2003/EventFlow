"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Cog6ToothIcon,
  CreditCardIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CheckIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

interface SettingEntry {
  key: string;
  value: string;
  type: string;
  group: string;
  label: string;
  description?: string;
  updatedAt?: string | null;
}

interface EnvInfo {
  khaltiEnvironment: string;
  khaltiConfigured: boolean;
  esewaConfigured: boolean;
  smtpConfigured: boolean;
  smtpFrom: string;
  appUrl: string;
  adminEmails: string;
}

interface SettingsResponse {
  settings: Record<string, SettingEntry>;
  env: EnvInfo;
}

type Tab = "general" | "payments" | "email";

const TABS: { id: Tab; label: string; icon: ElementType }[] = [
  { id: "general", label: "General", icon: Cog6ToothIcon },
  { id: "payments", label: "Payments", icon: CreditCardIcon },
  { id: "email", label: "Email", icon: EnvelopeIcon },
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("general");
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const result = (await response.json()) as SettingsResponse;
        setData(result);
        const next: Record<string, string> = {};
        for (const [key, entry] of Object.entries(result.settings)) {
          next[key] = entry.value;
        }
        setValues(next);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, []);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: entries }),
      });
      const result = await response.json();
      if (response.ok) {
        setMessage({ type: "success", text: result.message || "Settings saved" });
        await fetchSettings();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save settings" });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN" || !data) {
    return null;
  }

  const groupEntries = Object.values(data.settings).filter((s) => s.group === tab);
  const env = data.env;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Cog6ToothIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Platform Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure platform-wide options
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Discard</span>
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-4 mb-6 ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Settings Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 gap-6">
          {groupEntries.map((entry) => {
            const current = values[entry.key] ?? entry.value;
            const isBool = entry.type === "boolean";
            return (
              <div
                key={entry.key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    {entry.label}
                  </label>
                  {entry.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>
                  )}
                  {entry.updatedAt && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Last updated: {new Date(entry.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="sm:w-72">
                  {isBool ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {current === "true" ? "Enabled" : "Disabled"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            [entry.key]: current === "true" ? "false" : "true",
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                          current === "true" ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            current === "true" ? "translate-x-6" : "translate-x-1"
                          } mt-1`}
                        />
                      </button>
                    </div>
                  ) : (
                    <input
                      type={entry.type === "number" ? "number" : "text"}
                      value={current}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [entry.key]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Environment Status */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Environment & Services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCardIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Khalti
              </h3>
              <span
                className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  env.khaltiConfigured
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    env.khaltiConfigured ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {env.khaltiConfigured ? "Configured" : "Not configured"}
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-400">Environment</dt>
                <dd className="text-gray-600 dark:text-gray-300 capitalize">
                  {env.khaltiEnvironment}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Secret key</dt>
                <dd className="text-gray-600 dark:text-gray-300">
                  {env.khaltiConfigured ? "••••••••" : "Missing"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BuildingOffice2Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                eSewa
              </h3>
              <span
                className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  env.esewaConfigured
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    env.esewaConfigured ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {env.esewaConfigured ? "Configured" : "Not configured"}
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-400">Product code</dt>
                <dd className="text-gray-600 dark:text-gray-300">
                  {env.esewaConfigured ? "✓ Set" : "Missing"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Secret key</dt>
                <dd className="text-gray-600 dark:text-gray-300">
                  {env.esewaConfigured ? "••••••••" : "Missing"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <EnvelopeIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                SMTP
              </h3>
              <span
                className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  env.smtpConfigured
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    env.smtpConfigured ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {env.smtpConfigured ? "Configured" : "Not configured"}
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-400">From</dt>
                <dd className="text-gray-600 dark:text-gray-300">
                  {env.smtpFrom || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Admin emails</dt>
                <dd className="text-gray-600 dark:text-gray-300 truncate max-w-[10rem]">
                  {env.adminEmails || "Not set"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Cog6ToothIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Application
              </h3>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">App URL</dt>
                <dd className="text-gray-600 dark:text-gray-300 truncate">{env.appUrl}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
