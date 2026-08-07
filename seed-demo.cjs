// seed-demo.cjs
// Populate the dev database with realistic demo content:
//   - 8 vendors (varied service types) with packages + add-ons
//   - 2 organizers with 3 ticketed events each
//   - 2 customer USER accounts
// Every account's password is `habil1234` and all are email-verified + APPROVED,
// so they can sign in immediately. Idempotent (upserts by email).
//
// Usage: node seed-demo.cjs   (must run from the repo root; reads .env)

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

for (const line of readFileSync(join(__dirname, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const PASSWORD = "habil1234";

const SERVICE_TYPES = [
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

const VENDORS = [
  {
    email: "himalayan.feast@eventflow.test",
    name: "Himalayan Feast Catering",
    serviceType: "catering",
    location: "Kathmandu",
    description:
      "Premium Nepali & international catering for weddings, corporate galas and private dinners. Farm-to-table ingredients, live cooking counters and impeccable service.",
    imageUrl: "https://images.unsplash.com/photo-1555244162-803834f70033",
    packages: [
      {
        name: "Royal Wedding Feast",
        price: 1500,
        pricingType: "per_person",
        minGuests: 100,
        maxGuests: 500,
        description:
          "✦ Multi-course Nepali thali with 3 main dishes\n✦ Live momo & sekewa counter\n✦ Dedicated serving staff & chef\n✦ Table setup with premium linen",
        imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d",
        addOns: [
          { name: "Live Pasta Counter", extraPrice: 300, pricingType: "per_person" },
          { name: "Mocktail Bar", extraPrice: 250, pricingType: "per_person" },
        ],
      },
      {
        name: "Corporate Catering Pack",
        price: 60000,
        pricingType: "fixed",
        minGuests: 50,
        maxGuests: 200,
        description:
          "✦ Buffet for up to 200 guests\n✦ Continental + local options\n✦ Beverage station\n✦ 4-hour service window",
        imageUrl: "https://images.unsplash.com/photo-1547573854-74d2a71d0826",
        addOns: [{ name: "Coffee Corner", extraPrice: 5000, pricingType: "fixed" }],
      },
    ],
  },
  {
    email: "lens.light@eventflow.test",
    name: "Lens & Light Photography",
    serviceType: "photography",
    location: "Lalitpur",
    description:
      "Cinematic wedding and event photography. Two photographers, drone coverage and same-week highlight reels.",
    imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552",
    packages: [
      {
        name: "Golden Hour Session",
        price: 25000,
        pricingType: "fixed",
        minGuests: 1,
        maxGuests: 50,
        description:
          "✦ 2-hour outdoor shoot\n✦ 30 edited digital photos\n✦ Online gallery within 5 days",
        imageUrl: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d",
        addOns: [{ name: "Extra Hour", extraPrice: 4000, pricingType: "fixed" }],
      },
      {
        name: "Full Wedding Film",
        price: 120000,
        pricingType: "fixed",
        minGuests: 50,
        maxGuests: 1000,
        description:
          "✦ Full-day coverage (2 photographers)\n✦ Drone aerials\n✦ 10-minute cinematic film + 400 photos",
        imageUrl: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486",
        addOns: [
          { name: "Highlight Reel (60s)", extraPrice: 15000, pricingType: "fixed" },
          { name: "Extra Photographer", extraPrice: 20000, pricingType: "fixed" },
        ],
      },
    ],
  },
  {
    email: "bloom.decor@eventflow.test",
    name: "Bloom & Vines Decor",
    serviceType: "decoration",
    location: "Pokhara",
    description:
      "Floral stage design, mandap decor and ambient lighting. We turn venues into dreamscapes.",
    imageUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed",
    packages: [
      {
        name: "Intimate Floral Decor",
        price: 45000,
        pricingType: "fixed",
        minGuests: 20,
        maxGuests: 150,
        description:
          "✦ Entrance arch + aisle florals\n✦ 10 table centerpieces\n✦ Fairy-light backdrop",
        imageUrl: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3",
        addOns: [
          { name: "Extra Centerpiece (per table)", extraPrice: 1500, pricingType: "per_person" },
        ],
      },
      {
        name: "Grand Wedding Set",
        price: 250000,
        pricingType: "fixed",
        minGuests: 150,
        maxGuests: 800,
        description:
          "✦ Full stage + mandap design\n✦ Premium floral walls\n✦ Coordinated color theme\n✦ DJ booth styling",
        imageUrl: "https://images.unsplash.com/photo-1478161628075-9b09a6b79c5c",
        addOns: [{ name: "Custom Monogram Logo", extraPrice: 12000, pricingType: "fixed" }],
      },
    ],
  },
  {
    email: "glow.makeup@eventflow.test",
    name: "Makeup by Anju",
    serviceType: "makeup",
    location: "Kathmandu",
    description:
      "Bridal and party makeup artistry using premium brands. On-location service available across the valley.",
    imageUrl: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2",
    packages: [
      {
        name: "Bridal Makeup",
        price: 15000,
        pricingType: "fixed",
        minGuests: 1,
        maxGuests: 1,
        description:
          "✦ Trial session included\n✦ HD airbrush base\n✦ Hair styling + dupatta pinning\n✦ Touch-up kit",
        imageUrl: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937",
        addOns: [
          { name: "Saree Draping", extraPrice: 2500, pricingType: "fixed" },
          { name: "Trial Makeup", extraPrice: 5000, pricingType: "fixed" },
        ],
      },
      {
        name: "Party Glam (per person)",
        price: 2500,
        pricingType: "per_person",
        minGuests: 5,
        maxGuests: 30,
        description:
          "✦ Makeup + hairstyle for events\n✦ Group booking discount on 10+\n✦ On-location within Kathmandu",
        imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035",
        addOns: [{ name: "False Lashes", extraPrice: 400, pricingType: "per_person" }],
      },
    ],
  },
  {
    email: "bassline.djs@eventflow.test",
    name: "Bassline Sounds",
    serviceType: "dj",
    location: "Pokhara",
    description:
      "High-energy DJs + full sound & lighting rigs. Weddings, festivals and private parties.",
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745",
    packages: [
      {
        name: "Wedding DJ",
        price: 30000,
        pricingType: "fixed",
        minGuests: 50,
        maxGuests: 500,
        description:
          "✦ 5-hour set\n✦ DJ + MC emceeing\n✦ PA system + mic\n✦ Uplighting included",
        imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81",
        addOns: [
          { name: "Extra Hour", extraPrice: 5000, pricingType: "fixed" },
          { name: "Smoke Machine", extraPrice: 3000, pricingType: "fixed" },
        ],
      },
      {
        name: "Festival Stage",
        price: 150000,
        pricingType: "fixed",
        minGuests: 500,
        maxGuests: 5000,
        description:
          "✦ Full PA + subwoofer stack\n✦ 2 DJs + light show\n✦ 8-hour main-stage set",
        imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30",
        addOns: [{ name: "LED Screen", extraPrice: 60000, pricingType: "fixed" }],
      },
    ],
  },
  {
    email: "everest.garden@eventflow.test",
    name: "Everest Garden Venue",
    serviceType: "venue",
    location: "Kathmandu",
    description:
      "Scenic garden venue with indoor hall, lawns and mountain views. Capacity up to 800 guests.",
    imageUrl: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3",
    packages: [
      {
        name: "Garden Day Rental",
        price: 90000,
        pricingType: "fixed",
        minGuests: 100,
        maxGuests: 800,
        description:
          "✦ Full-day exclusive garden use\n✦ Stage + seating for 300\n✦ Parking for 50 cars\n✦ In-house generator",
        imageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678",
        addOns: [
          { name: "Extended Evening (4h)", extraPrice: 25000, pricingType: "fixed" },
          { name: "Bridal Suite", extraPrice: 10000, pricingType: "fixed" },
        ],
      },
    ],
  },
  {
    email: "royal.coach@eventflow.test",
    name: "Royal Wedding Cars",
    serviceType: "transport",
    location: "Lalitpur",
    description:
      "Luxury car fleet for weddings and events — vintage, luxury sedans and SUVs with chauffeurs.",
    imageUrl: "https://images.unsplash.com/photo-1494976388531762-8c30a5d9dab4",
    packages: [
      {
        name: "Luxury Sedan (3 cars)",
        price: 18000,
        pricingType: "fixed",
        minGuests: 1,
        maxGuests: 6,
        description:
          "✦ 3 luxury sedans + chauffeurs\n✦ 6-hour service\n✦ Ribbon & floral detailing",
        imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2",
        addOns: [{ name: "Extra Car", extraPrice: 6000, pricingType: "fixed" }],
      },
      {
        name: "Vintage Convoy",
        price: 45000,
        pricingType: "fixed",
        minGuests: 10,
        maxGuests: 30,
        description:
          "✦ 2 vintage classics + 4 sedans\n✦ Full-day convoy for bari + janti\n✦ Coordinated decorations",
        imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
        addOns: [{ name: "Motorbike Escort", extraPrice: 8000, pricingType: "fixed" }],
      },
    ],
  },
  {
    email: "memento.gifts@eventflow.test",
    name: "Memento Gifts & Favors",
    serviceType: "gifts",
    location: "Patan",
    description:
      "Custom wedding favors, return gifts, hamper boxes and event giveaways with your branding.",
    imageUrl: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f",
    packages: [
      {
        name: "Welcome Hamper (per box)",
        price: 1200,
        pricingType: "per_person",
        minGuests: 20,
        maxGuests: 500,
        description:
          "✦ Curated local treats box\n✦ Personalized name tag\n✦ Ribbon-wrapped",
        imageUrl: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7",
        addOns: [{ name: "Custom Print Label", extraPrice: 150, pricingType: "per_person" }],
      },
      {
        name: "Branded Gift Packs",
        price: 80000,
        pricingType: "fixed",
        minGuests: 100,
        maxGuests: 1000,
        description:
          "✦ 200 branded gift packs\n✦ Event name printing\n✦ Delivery across the valley",
        imageUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48",
        addOns: [{ name: "Extra 50 Packs", extraPrice: 15000, pricingType: "fixed" }],
      },
    ],
  },
];

const ORGANIZERS = [
  {
    email: "mountain.melodies@eventflow.test",
    name: "Mountain Melodies Events",
    businessType: "MUSIC",
    events: [
      {
        title: "Kathmandu Jazz & Soul Festival 2026",
        description:
          "Two days of jazz, soul and Nepali folk fusion at the Everest Garden. 20+ live acts across two stages.",
        imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
        eventDateDays: 25,
        eventTime: "16:00",
        location: "Kathmandu",
        capacity: 800,
        tiers: [
          { name: "General Admission", price: 1500, quantity: 600 },
          { name: "VIP Lounge", price: 4000, quantity: 150 },
          { name: "Backstage Pass", price: 9000, quantity: 50 },
        ],
      },
      {
        title: "Fusion Nepali Folk Night",
        description:
          "A celebration of Nepali folk music reimagined with modern production. Come dance under the stars in Pokhara.",
        imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea",
        eventDateDays: 45,
        location: "Pokhara",
        capacity: 500,
        tiers: [
          { name: "General Admission", price: 1000, quantity: 400 },
          { name: "Front Row", price: 2500, quantity: 100 },
        ],
      },
      {
        title: "Sunrise Yoga & Brunch Retreat",
        description:
          "Morning yoga overlooking the mountains, followed by a wholesome brunch and acoustic set. Limited to 120 guests.",
        imageUrl: "https://images.unsplash.com/photo-1522878123411-8219cb1ed253",
        eventDateDays: 60,
        location: "Dhulikhel",
        capacity: 120,
        tiers: [
          { name: "Day Pass", price: 3000, quantity: 120 },
          { name: "Retreat + Stay", price: 8000, quantity: 30 },
        ],
      },
    ],
  },
  {
    email: "city.nites@eventflow.test",
    name: "City Nites Productions",
    businessType: "EVENT",
    events: [
      {
        title: "Pokhara Night Market & Food Fest",
        description:
          "100+ food stalls, live bands and a curated craft market. Family friendly with kids' zones.",
        imageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf",
        eventDateDays: 15,
        location: "Pokhara",
        capacity: 1500,
        tiers: [
          { name: "Entry Pass", price: 500, quantity: 1200 },
          { name: "VIP Circle", price: 2000, quantity: 300 },
        ],
      },
      {
        title: "EDM Night Under the Stars",
        description:
          "Top DJs from the region headline an open-air electronic night with state-of-the-art production.",
        imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
        eventDateDays: 35,
        location: "Lakeside, Pokhara",
        capacity: 1000,
        tiers: [
          { name: "General Admission", price: 2000, quantity: 700 },
          { name: "VIP Deck", price: 5000, quantity: 200 },
          { name: "Table for 6", price: 30000, quantity: 20 },
        ],
      },
      {
        title: "Bhakti & Beats — Temple Concert",
        description:
          "A soulful evening of devotional music reimagined with contemporary beats. Proceeds support local musicians.",
        imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad",
        eventDateDays: 80,
        location: "Patan Durbar Square",
        capacity: 400,
        tiers: [
          { name: "General Admission", price: 1200, quantity: 400 },
        ],
      },
    ],
  },
];

const USERS = [
  { email: "aman@eventflow.test", name: "Aman Gurung" },
  { email: "sita@eventflow.test", name: "Sita Shrestha" },
];

async function upsertUser({ email, name, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { name, role, status: "APPROVED", emailVerified: new Date() },
    });
    return existing;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.create({
    data: { name, email, passwordHash: hash, role, status: "APPROVED", emailVerified: new Date() },
  });
}

async function seedVendor(v) {
  const user = await upsertUser({ email: v.email, name: v.name, role: "VENDOR" });
  const profile = await prisma.vendorProfile.upsert({
    where: { userId: user.id },
    update: {
      businessName: v.name,
      serviceType: v.serviceType,
      location: v.location,
      description: v.description,
      imageUrl: v.imageUrl,
    },
    create: {
      userId: user.id,
      businessName: v.name,
      serviceType: v.serviceType,
      location: v.location,
      description: v.description,
      imageUrl: v.imageUrl,
      galleryImages: [],
    },
  });
  for (const pkg of v.packages) {
    const existingPkg = await prisma.servicePackage.findFirst({
      where: { vendorId: profile.id, name: pkg.name },
    });
    const servicePackage = existingPkg
      ? await prisma.servicePackage.update({
          where: { id: existingPkg.id },
          data: {
            name: pkg.name,
            price: pkg.price,
            description: pkg.description,
            imageUrl: pkg.imageUrl,
            pricingType: pkg.pricingType,
            minGuests: pkg.minGuests,
            maxGuests: pkg.maxGuests,
            isActive: true,
            status: "active",
          },
        })
      : await prisma.servicePackage.create({
          data: {
            vendorId: profile.id,
            name: pkg.name,
            price: pkg.price,
            description: pkg.description,
            imageUrl: pkg.imageUrl,
            galleryImages: [],
            pricingType: pkg.pricingType,
            minGuests: pkg.minGuests,
            maxGuests: pkg.maxGuests,
            isActive: true,
            status: "active",
          },
        });
    await prisma.packageAddOn.deleteMany({ where: { packageId: servicePackage.id } });
    for (const addOn of pkg.addOns || []) {
      await prisma.packageAddOn.create({
        data: {
          packageId: servicePackage.id,
          name: addOn.name,
          extraPrice: addOn.extraPrice,
          pricingType: addOn.pricingType,
          isOptional: true,
        },
      });
    }
  }
  console.log(`  vendor: ${v.email} (${v.serviceType}) — ${v.packages.length} packages`);
}

async function seedOrganizer(o) {
  const user = await upsertUser({ email: o.email, name: o.name, role: "ORGANIZER" });
  await prisma.organizerProfile.upsert({
    where: { userId: user.id },
    update: { businessName: o.name, businessType: o.businessType },
    create: { userId: user.id, businessName: o.name, businessType: o.businessType },
  });
  for (const ev of o.events) {
    const existing = await prisma.ticketedEvent.findFirst({
      where: { organizerId: user.id, title: ev.title },
    });
    const eventDate = new Date(Date.now() + ev.eventDateDays * 86400000);
    const event = existing
      ? await prisma.ticketedEvent.update({
          where: { id: existing.id },
          data: {
            title: ev.title,
            description: ev.description,
            imageUrl: ev.imageUrl,
            eventDate,
            eventTime: ev.eventTime || "18:00",
            location: ev.location,
            capacity: ev.capacity,
            isActive: true,
            isCompleted: false,
          },
        })
      : await prisma.ticketedEvent.create({
          data: {
            organizerId: user.id,
            title: ev.title,
            description: ev.description,
            imageUrl: ev.imageUrl,
            galleryImages: [],
            eventDate,
            eventTime: ev.eventTime || "18:00",
            location: ev.location,
            capacity: ev.capacity,
            isActive: true,
            isCompleted: false,
          },
        });
    await prisma.ticketTier.deleteMany({ where: { eventId: event.id } });
    for (const tier of ev.tiers) {
      await prisma.ticketTier.create({
        data: {
          eventId: event.id,
          name: tier.name,
          price: tier.price,
          quantity: tier.quantity,
          soldCount: 0,
        },
      });
    }
  }
  console.log(`  organizer: ${o.email} — ${o.events.length} events`);
}

async function seedServiceTypes() {
  for (const st of SERVICE_TYPES) {
    await prisma.serviceType.upsert({
      where: { id: st.id },
      update: { label: st.label, emoji: st.emoji, isActive: true },
      create: {
        id: st.id,
        label: st.label,
        emoji: st.emoji,
        isActive: true,
        sortOrder: SERVICE_TYPES.findIndex((s) => s.id === st.id),
      },
    });
  }
  console.log(`  service types: ${SERVICE_TYPES.length}`);
}

async function main() {
  console.log("Seeding demo content...");
  await seedServiceTypes();
  for (const v of VENDORS) await seedVendor(v);
  for (const o of ORGANIZERS) await seedOrganizer(o);
  for (const u of USERS) await upsertUser({ email: u.email, name: u.name, role: "USER" });
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());