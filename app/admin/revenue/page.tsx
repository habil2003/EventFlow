"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Cog6ToothIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  TicketIcon,
  BellIcon,
  ScaleIcon,
  DocumentTextIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

// Map page names to icons
const pageIcons: Record<string, any> = {
    notifications: BellIcon,
    commissions: ScaleIcon,
    revenue: DocumentTextIcon,
    vendors: BuildingOfficeIcon,
    organizers: UserGroupIcon,
    tickets: TicketIcon,
    settings: Cog6ToothIcon,
    "email-templates": EnvelopeIcon,
};

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

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

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const Icon = pageIcons["revenue"] || Cog6ToothIcon;
  const pageName = "revenue".replace('-', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Icon className="h-8 w-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {pageName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage {pageName.toLowerCase()} on the platform
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
        <Icon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          The {pageName.toLowerCase()} management page is under development.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Check back later for updates.
        </p>
      </div>
    </div>
  );
}
