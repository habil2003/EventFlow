export interface ServiceTypeMeta {
  id: string;
  label: string;
  emoji: string;
}

export const DEFAULT_SERVICE_TYPES: ServiceTypeMeta[] = [
  { id: "venue", label: "Venue", emoji: "🏛️" },
  { id: "catering", label: "Catering", emoji: "🍽️" },
  { id: "photography", label: "Photography", emoji: "📸" },
  { id: "decoration", label: "Decoration", emoji: "💐" },
  { id: "makeup", label: "Makeup", emoji: "💄" },
  { id: "dj", label: "DJ & Music", emoji: "🎧" },
  { id: "transport", label: "Transport", emoji: "🚗" },
  { id: "invitation", label: "Invitation", emoji: "💌" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "gifts", label: "Gifts", emoji: "🎁" },
];

export const DEFAULT_SERVICE_TYPE_MAP = new Map<string, ServiceTypeMeta>(
  DEFAULT_SERVICE_TYPES.map((s) => [s.id, s])
);

export function getServiceTypeMeta(id?: string | null): ServiceTypeMeta | undefined {
  if (!id) return undefined;
  return DEFAULT_SERVICE_TYPE_MAP.get(id);
}

export function getServiceTypeLabel(id?: string | null): string {
  return getServiceTypeMeta(id)?.label ?? id ?? "Service";
}

export function getServiceTypeEmoji(id?: string | null): string {
  return getServiceTypeMeta(id)?.emoji ?? "🏪";
}
