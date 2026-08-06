"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import ThemeWrapper from "@/components/ThemeWrapper";
import Image from "next/image";
import { 
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  MapPinIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  serviceType: string;
  location: string;
  description: string;
  imageUrl?: string;
  status: string;
  user: {
    name: string;
    email: string;
    createdAt: string;
  };
}

interface Organizer {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

// ✅ Component that uses useSearchParams()
function ApprovalsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "vendors";
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Vendor | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectItemType, setRejectItemType] = useState<string | null>(null);
  const [rejectUserId, setRejectUserId] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vendorsRes, organizersRes] = await Promise.all([
          fetch("/api/admin/vendors"),
          fetch("/api/admin/organizers"),
        ]);
        if (vendorsRes.ok) setVendors(await vendorsRes.json());
        if (organizersRes.ok) setOrganizers(await organizersRes.json());
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateStatus = async (userId: string, role: string, status: string, reason?: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, status, reason }),
      });

      if (response.ok) {
        showMessage(`${role} ${status.toLowerCase()} successfully`, "success");
        const [vendorsRes, organizersRes] = await Promise.all([
          fetch("/api/admin/vendors"),
          fetch("/api/admin/organizers"),
        ]);
        if (vendorsRes.ok) setVendors(await vendorsRes.json());
        if (organizersRes.ok) setOrganizers(await organizersRes.json());
      } else {
        showMessage("Failed to update status", "error");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showMessage("Error updating status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = (userId: string, role: string) => {
    updateStatus(userId, role, "APPROVED", undefined);
  };

  const handleReject = () => {
    if (rejectUserId && rejectItemType) {
      updateStatus(rejectUserId, rejectItemType, "BLOCKED", rejectionReason);
    }
    setShowRejectModal(false);
    setRejectionReason("");
    setRejectItemType(null);
    setRejectUserId(null);
  };

  const openRejectModal = (userId: string, role: string) => {
    setRejectUserId(userId);
    setRejectItemType(role);
    setShowRejectModal(true);
  };

  const pendingVendors = vendors.filter(v => v.status === "PENDING");
  const pendingOrganizers = organizers.filter(o => o.status === "PENDING");
  const approvedVendors = vendors.filter(v => v.status === "APPROVED");
  const approvedOrganizers = organizers.filter(o => o.status === "APPROVED");

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading approvals...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Message Alert */}
        {message && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg min-w-[300px] text-center ${
            message.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}>
            <div className="flex items-center justify-center gap-3">
              {message.type === "success" ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600" />
              )}
              <p className={`text-sm font-medium ${message.type === "success" ? "text-green-800" : "text-red-800"}`}>
                {message.text}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-6">
            <Link
              href="/admin/approvals?tab=vendors"
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                tab === "vendors"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Vendors ({pendingVendors.length} pending)
            </Link>
            <Link
              href="/admin/approvals?tab=organizers"
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                tab === "organizers"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Organizers ({pendingOrganizers.length} pending)
            </Link>
          </nav>
        </div>

        {/* Vendors Tab */}
        {tab === "vendors" && (
          <>
            {/* Pending Vendors */}
            {pendingVendors.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Pending Approvals ({pendingVendors.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingVendors.map((vendor) => (
                    <div key={vendor.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all">
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Vendor Image Placeholder */}
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                            {vendor.imageUrl ? (
                              <Image src={vendor.imageUrl} alt={vendor.businessName} fill sizes="64px" className="object-cover rounded-lg" />
                            ) : (
                              <BuildingOfficeIcon className="h-8 w-8 text-indigo-500" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                  {vendor.businessName}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {vendor.user.name}
                                </p>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex-shrink-0">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                Pending
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="capitalize">{vendor.serviceType}</span>
                              <span>{vendor.location}</span>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                              {vendor.description || "No description provided"}
                            </p>
                            
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => {
                                  setSelectedItem(vendor);
                                  setShowDetailModal(true);
                                }}
                                className="flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              >
                                <EyeIcon className="h-4 w-4 mr-1" />
                                View Details
                              </button>
                              <button
                                onClick={() => handleApprove(vendor.userId, "VENDOR")}
                                disabled={actionLoading === vendor.id}
                                className="flex items-center px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Approve
                              </button>
                              <button
                                onClick={() => openRejectModal(vendor.userId, "VENDOR")}
                                disabled={actionLoading === vendor.id}
                                className="flex items-center px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                <XCircleIcon className="h-4 w-4 mr-1" />
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Vendors */}
            {approvedVendors.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Approved Vendors ({approvedVendors.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
                  {approvedVendors.map((vendor) => (
                    <div key={vendor.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <BuildingOfficeIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{vendor.businessName}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{vendor.user.name}</p>
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                setSelectedItem(vendor);
                                setShowDetailModal(true);
                              }}
                              className="text-sm text-indigo-600 hover:underline"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => updateStatus(vendor.userId, "VENDOR", "BLOCKED", undefined)}
                          disabled={actionLoading === vendor.id}
                          className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingVendors.length === 0 && approvedVendors.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No vendors found</p>
              </div>
            )}
          </>
        )}

        {/* Organizers Tab */}
        {tab === "organizers" && (
          <>
            {/* Pending Organizers */}
            {pendingOrganizers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Pending Approvals ({pendingOrganizers.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingOrganizers.map((org) => (
                    <div key={org.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-6 w-6 text-indigo-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{org.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{org.email}</p>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                            <span className="flex items-center">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              Joined: {new Date(org.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(org.id, "ORGANIZER")}
                            disabled={actionLoading === org.id}
                            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(org.id, "ORGANIZER")}
                            disabled={actionLoading === org.id}
                            className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Organizers */}
            {approvedOrganizers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Approved Organizers ({approvedOrganizers.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
                  {approvedOrganizers.map((org) => (
                    <div key={org.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{org.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{org.email}</p>
                        </div>
                        <button
                          onClick={() => updateStatus(org.id, "ORGANIZER", "BLOCKED", undefined)}
                          disabled={actionLoading === org.id}
                          className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingOrganizers.length === 0 && approvedOrganizers.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No organizers found</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 sticky top-0">
              <h2 className="text-xl font-bold text-white">Vendor Details</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Vendor Image */}
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center overflow-hidden relative">
                  {selectedItem.imageUrl ? (
                    <Image src={selectedItem.imageUrl} alt={selectedItem.businessName} fill sizes="128px" className="object-cover" />
                  ) : (
                    <BuildingOfficeIcon className="h-12 w-12 text-indigo-500" />
                  )}
                </div>
              </div>
              
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500">Business Name</p>
                <p className="font-semibold text-gray-900 dark:text-white text-lg">{selectedItem.businessName}</p>
              </div>
              
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500">Owner Information</p>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{selectedItem.user?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{selectedItem.user?.email}</span>
                  </div>
                </div>
              </div>
              
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500">Service Type</p>
                <p className="text-gray-900 dark:text-white capitalize">{selectedItem.serviceType}</p>
              </div>
              
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500">Location</p>
                <div className="flex items-center gap-2 mt-1">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white">{selectedItem.location}</span>
                </div>
              </div>
              
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4">
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700 dark:text-gray-300 mt-1">
                  {selectedItem.description || "No description provided"}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Registration Date</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(selectedItem.user?.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end sticky bottom-0 bg-white dark:bg-gray-800 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
              {selectedItem.status === "PENDING" && (
                <>
                  <button
                    onClick={() => {
                      handleApprove(selectedItem.userId, "VENDOR");
                      setShowDetailModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      openRejectModal(selectedItem.userId, "VENDOR");
                      setShowDetailModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white">Reject Application</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Please provide a reason for rejection (optional):
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g., Incomplete information, Invalid business license, etc."
              />
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ✅ Main export with ThemeWrapper and Suspense boundary
export default function ApprovalsPage() {
  return (
    <ThemeWrapper>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="mt-2 text-sm text-gray-500">Loading approvals...</p>
          </div>
        </div>
      }>
        <ApprovalsContent />
      </Suspense>
    </ThemeWrapper>
  );
}