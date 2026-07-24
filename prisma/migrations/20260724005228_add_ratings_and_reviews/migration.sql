-- CreateEnum
CREATE TYPE "RatingType" AS ENUM ('VENDOR', 'EVENT');

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "type" "RatingType" NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT,
    "eventId" TEXT,
    "vendorBookingId" TEXT,
    "ticketBookingId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_vendorId_idx" ON "Rating"("vendorId");

-- CreateIndex
CREATE INDEX "Rating_eventId_idx" ON "Rating"("eventId");

-- CreateIndex
CREATE INDEX "Rating_userId_idx" ON "Rating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_vendorId_vendorBookingId_key" ON "Rating"("userId", "vendorId", "vendorBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_eventId_ticketBookingId_key" ON "Rating"("userId", "eventId", "ticketBookingId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TicketedEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_vendorBookingId_fkey" FOREIGN KEY ("vendorBookingId") REFERENCES "VendorBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_ticketBookingId_fkey" FOREIGN KEY ("ticketBookingId") REFERENCES "TicketBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
