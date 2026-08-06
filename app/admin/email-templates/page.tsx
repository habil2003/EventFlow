"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  EnvelopeIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface EmailTemplate {
  key: string;
  name: string;
  description: string;
  trigger: string;
  subject: string;
  to: string;
  icon: string;
  preview: string;
}

const TEMPLATE_ICONS: Record<string, ElementType> = {
  verification: UserIcon,
  resetPassword: ShieldCheckIcon,
  bookingAccepted: CheckCircleIcon,
  bookingDeclined: ExclamationCircleIcon,
  adminRefundAlert: ClockIcon,
  test: PaperAirplaneIcon,
};

export default function EmailTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
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

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/email-templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
        setSmtpConfigured(Boolean(data.smtpConfigured));
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplates();
  }, []);

  const sendTest = async (templateKey: string) => {
    setSending(templateKey);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateKey }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: "success", text: data.message || "Test email sent!" });
      } else {
        setMessage({
          type: "error",
          text: data.error || data.details || "Failed to send test email",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send test email",
      });
    } finally {
      setSending(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading email templates...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <EnvelopeIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Email Templates
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review transactional emails and send test copies
            </p>
          </div>
        </div>
        <button
          onClick={fetchTemplates}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Refresh
          </span>
        </button>
      </div>

      {/* SMTP Status */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 mb-6 ${
          smtpConfigured
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
        }`}
      >
        {smtpConfigured ? (
          <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
        ) : (
          <ExclamationCircleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        )}
        <div>
          <p
            className={`text-sm font-semibold ${
              smtpConfigured
                ? "text-green-800 dark:text-green-300"
                : "text-yellow-800 dark:text-yellow-300"
            }`}
          >
            {smtpConfigured
              ? "SMTP is configured"
              : "SMTP is not configured"}
          </p>
          <p
            className={`text-xs ${
              smtpConfigured
                ? "text-green-700 dark:text-green-400"
                : "text-yellow-700 dark:text-yellow-400"
            }`}
          >
            {smtpConfigured
              ? "Transactional emails will be delivered via your SMTP provider."
              : "Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM env variables."}
          </p>
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

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((template) => {
          const Icon = TEMPLATE_ICONS[template.key] || EnvelopeIcon;
          const isPreviewing = preview === template.key;
          return (
            <div
              key={template.key}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{template.trigger}</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 flex-1">
                {template.description}
              </p>

              <div className="mt-4 space-y-2 text-xs bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400 font-medium">To</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">{template.to}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400 font-medium">Subject</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">
                    {template.subject}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setPreview(isPreviewing ? null : template.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {isPreviewing ? (
                    <>
                      <EyeSlashIcon className="h-3.5 w-3.5" />
                      Hide Preview
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-3.5 w-3.5" />
                      Preview
                    </>
                  )}
                </button>
                <button
                  onClick={() => sendTest(template.key)}
                  disabled={sending !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {sending === template.key ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <PaperAirplaneIcon className="h-3.5 w-3.5" />
                  )}
                  {sending === template.key ? "Sending..." : "Send Test"}
                </button>
              </div>

              {isPreviewing && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Subject: {template.subject}
                  </p>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="h-2 w-2 rounded-full bg-red-400"></span>
                      <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
                      <span className="h-2 w-2 rounded-full bg-green-400"></span>
                      <span className="text-[10px] text-gray-400 ml-2">
                        eventflow.example
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 max-h-64 overflow-y-auto text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                      {template.preview}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
