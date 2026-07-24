// lib/event-helpers.ts

interface BookingForStatus {
  bookingStatus: string;
  totalAmount: number | string; // Decimal comes in as string/Decimal from Prisma in some call sites
  vendorId?: string;
}

export function computeEventDerivedStatus(
  eventStatus: string,
  eventDate: Date | string,
  bookings: BookingForStatus[]
) {
  const eventHasPassed = new Date(eventDate) < new Date();

  const completed = bookings.filter((b) => b.bookingStatus === "COMPLETED").length;
  const declined = bookings.filter((b) => b.bookingStatus === "DECLINED").length;
  const pending = bookings.filter((b) => b.bookingStatus === "PENDING").length;
  const accepted = bookings.filter((b) => b.bookingStatus === "ACCEPTED").length;

  // Active = not declined. Used for both budget and vendor count so a
  // declined/refunded booking never inflates either figure.
  const activeBookings = bookings.filter((b) => b.bookingStatus !== "DECLINED");

  const totalSpent = activeBookings.reduce(
    (sum, b) => sum + Number(b.totalAmount),
    0
  );

  // Distinct vendors among active bookings (guards against the same vendor
  // being counted twice if declined-then-rebooked).
  const vendorCount = new Set(
    activeBookings
      .map((b) => b.vendorId)
      .filter((id): id is string => Boolean(id))
  ).size || activeBookings.length; // fallback if vendorId wasn't provided

  const allResolved =
    bookings.length > 0 &&
    bookings.every(
      (b) => b.bookingStatus === "COMPLETED" || b.bookingStatus === "DECLINED"
    );

  let derivedStatus = eventStatus;
  let derivedStatusLabel = "Planning";

  if (allResolved && bookings.length > 0) {
    derivedStatus = "COMPLETED";
    derivedStatusLabel = "Completed";
  } else if (eventHasPassed && (pending > 0 || accepted > 0)) {
    // Event day has come and gone but a booking never got marked
    // complete/confirmed — distinct from "still planning."
    derivedStatus = "AWAITING_COMPLETION";
    derivedStatusLabel = "Awaiting Completion";
  } else if (eventStatus === "PLANNING" && completed > 0) {
    derivedStatus = "IN_PROGRESS";
    derivedStatusLabel = "In Progress";
  } else {
    derivedStatusLabel =
      eventStatus === "PLANNING"
        ? "Planning"
        : eventStatus === "CONFIRMED"
        ? "Confirmed"
        : eventStatus === "COMPLETED"
        ? "Completed"
        : eventStatus;
  }

  return {
    eventHasPassed,
    derivedStatus,
    derivedStatusLabel,
    totalSpent,
    vendorCount,
    bookingSummary: {
      total: bookings.length,
      completed,
      pending,
      accepted,
      declined,
    },
  };
}