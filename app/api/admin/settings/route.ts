// app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Default settings that fall back when no row exists in the DB
const DEFAULT_SETTINGS: Record<
  string,
  { value: string; type: string; group: string; label: string; description?: string }
> = {
  "general.platformName": {
    value: "EventFlow",
    type: "string",
    group: "general",
    label: "Platform Name",
    description: "Name shown across the platform and in emails.",
  },
  "general.supportEmail": {
    value: "support@eventflow.com",
    type: "string",
    group: "general",
    label: "Support Email",
    description: "Contact email shown to users.",
  },
  "general.currency": {
    value: "NPR",
    type: "string",
    group: "general",
    label: "Currency",
    description: "Currency code used for display (e.g. NPR).",
  },
  "general.commissionRate": {
    value: "10",
    type: "number",
    group: "general",
    label: "Platform Commission Rate",
    description: "Percentage charged on each payout.",
  },
  "payments.khaltiEnabled": {
    value: "true",
    type: "boolean",
    group: "payments",
    label: "Enable Khalti",
    description: "Allow payments through Khalti.",
  },
  "payments.esewaEnabled": {
    value: "true",
    type: "boolean",
    group: "payments",
    label: "Enable eSewa",
    description: "Allow payments through eSewa.",
  },
  "payments.defaultGateway": {
    value: "KHALTI",
    type: "string",
    group: "payments",
    label: "Default Payment Gateway",
    description: "Preferred gateway shown first at checkout.",
  },
  "email.senderName": {
    value: "EventFlow",
    type: "string",
    group: "email",
    label: "Email Sender Name",
    description: "Display name used as the sender of transactional emails.",
  },
  "email.notifyAdminsOnRefund": {
    value: "true",
    type: "boolean",
    group: "email",
    label: "Notify Admins on Manual Refunds",
    description: "Send email to admins when a manual refund is required.",
  },
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stored = await prisma.platformSetting.findMany();

    const storedMap = new Map(stored.map((s) => [s.key, s]));

    const merged: Record<
      string,
      {
        key: string;
        value: string;
        type: string;
        group: string;
        label: string;
        description?: string;
        updatedAt: Date | null;
      }
    > = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const row = storedMap.get(key);
      merged[key] = {
        key,
        value: row ? row.value : def.value,
        type: row?.type || def.type,
        group: row?.group || def.group,
        label: row?.label || def.label,
        description: row?.description || def.description,
        updatedAt: row?.updatedAt || null,
      };
    }

    return NextResponse.json({
      success: true,
      settings: merged,
      env: {
        khaltiEnvironment:
          process.env.KHALTI_ENVIRONMENT || "sandbox",
        khaltiConfigured: Boolean(process.env.KHALTI_SECRET_KEY),
        esewaConfigured:
          Boolean(process.env.ESEWA_PRODUCT_CODE) &&
          Boolean(process.env.ESEWA_SECRET_KEY),
        smtpConfigured: Boolean(
          process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS
        ),
        smtpFrom: process.env.SMTP_FROM || "",
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        adminEmails: process.env.ADMIN_EMAILS || "",
      },
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const entries = body.settings as {
      key: string;
      value: string;
      type?: string;
      group?: string;
      label?: string;
      description?: string;
    }[];

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "No settings provided" },
        { status: 400 }
      );
    }

    for (const entry of entries) {
      const def = DEFAULT_SETTINGS[entry.key];
      if (!def) {
        return NextResponse.json(
          { error: `Unknown setting key: ${entry.key}` },
          { status: 400 }
        );
      }
      await prisma.platformSetting.upsert({
        where: { key: entry.key },
        update: {
          value: String(entry.value),
          updatedBy: session.user.id || session.user.email,
        },
        create: {
          key: entry.key,
          value: String(entry.value),
          type: entry.type || def.type,
          group: entry.group || def.group,
          label: entry.label || def.label,
          description: entry.description || def.description,
          updatedBy: session.user.id || session.user.email,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
