"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  TagIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface ServiceType {
  id: string;
  label: string;
  emoji: string;
  isActive: boolean;
  sortOrder: number;
}

interface FormState {
  id: string;
  label: string;
  emoji: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: "",
  label: "",
  emoji: "",
  sortOrder: "0",
  isActive: true,
};

export default function ServiceTypesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") router.push("/");
  }, [session, router]);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/service-types");
      if (response.ok) {
        const data = await response.json();
        setTypes(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching service types:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTypes();
  }, []);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (t: ServiceType) => {
    setEditing(t);
    setForm({
      id: t.id,
      label: t.label,
      emoji: t.emoji,
      sortOrder: String(t.sortOrder),
      isActive: t.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setMessage(null);
    const payload = {
      label: form.label,
      emoji: form.emoji,
      sortOrder: parseInt(form.sortOrder || "0", 10) || 0,
      isActive: form.isActive,
    };

    const response = await fetch(
      editing ? `/api/admin/service-types/${editing.id}` : "/api/admin/service-types",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? payload : { ...payload, id: form.id }),
      }
    );

    const data = await response.json();
    if (response.ok) {
      setModalOpen(false);
      showMessage("success", editing ? "Service type updated" : "Service type created");
      fetchTypes();
    } else {
      showMessage("error", data.error || "Failed to save service type");
    }
  };

  const handleDelete = async (t: ServiceType) => {
    if (!confirm(`Delete service type "${t.label}"?`)) return;
    setMessage(null);
    const response = await fetch(`/api/admin/service-types/${t.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (response.ok) {
      showMessage("success", "Service type deleted");
      fetchTypes();
    } else {
      showMessage("error", data.error || "Failed to delete service type");
    }
  };

  const handleToggleActive = async (t: ServiceType) => {
    const response = await fetch(`/api/admin/service-types/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (response.ok) {
      fetchTypes();
    } else {
      const data = await response.json();
      showMessage("error", data.error || "Failed to update service type");
    }
  };

  const activeCount = types.filter((t) => t.isActive).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Service Types</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {types.length} total · {activeCount} active · Vendor categories shown across the marketplace and signup
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow hover:from-indigo-700 hover:to-purple-700 transition-all"
        >
          <PlusIcon className="h-5 w-5" />
          Add Service Type
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <ExclamationCircleIcon className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <TagIcon className="h-12 w-12 mb-3" />
            <p className="text-sm font-medium">No service types yet</p>
            <p className="text-xs">Add your first service type to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">ID (slug)</th>
                  <th className="px-6 py-3">Sort</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {types.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openEdit(t)}
                        className="flex items-center gap-3 text-left group"
                        title="Edit"
                      >
                        <span className="text-2xl">{t.emoji}</span>
                        <span className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {t.label}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{t.id}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{t.sortOrder}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(t)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          t.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {t.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(t)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editing ? "Edit Service Type" : "Add Service Type"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  ID (slug, shown below)
                </label>
                <input
                  type="text"
                  value={form.id}
                  disabled={!!editing}
                  onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })}
                  placeholder="e.g. catering"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                />
                {editing && (
                  <p className="mt-1 text-xs text-gray-400">The slug cannot be changed after creation.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Label</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Catering"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Emoji</label>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    placeholder="🍽️"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                Active (visible in signup &amp; marketplace)
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                {editing ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
