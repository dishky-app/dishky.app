#!/usr/bin/env node
/**
 * seedEvents.js — Dishky server, one-time script
 * ----------------------------------------------------------------
 * Loads a realistic set of public events — sing-alongs, concerts,
 * carnivals, cultural nights, open mic, workshops and a movie night —
 * with sensible per-person prices (₹99 – ₹499). No weddings, catering
 * or celebration packages.
 *
 * USAGE
 * -----
 *   cd server
 *   node scripts/seedEvents.js --restaurant <slug>                 # add the events
 *   node scripts/seedEvents.js --restaurant <slug> --venue <id>    # a specific venue (default: main branch)
 *   node scripts/seedEvents.js --restaurant <slug> --dry-run       # show what would happen
 *   node scripts/seedEvents.js --restaurant <slug> --replace-existing
 *        # FIRST deletes every existing event of that venue AND the bookings made
 *        # for them, then adds the new set. Cannot be undone — take a backup first.
 *
 * Dates are generated relative to today (first event in 10 days, then roughly
 * one a week), so they are always upcoming. Safe to re-run: an event whose
 * title already exists for the venue is skipped.
 *
 * Requires the same .env (MONGO_URI) the main server uses.
 */
require("dotenv").config();
require("../src/core/tenancy");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { runInTenant, runAsPlatform } = require("../src/core/tenancy");
const { getModel } = require("../src/core/genericModel");
const { Restaurant } = require("../src/modules/platform/models");
const { Venue } = require("../src/modules/venues/venues");

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(`--${n}`);

// price is ₹ per person
const EVENTS = [
  { title: "Sunday Sing-Along: Evergreen Hits", eventType: "singalong", time: "18:00", price: 199, maxCapacity: 80,
    description: "Lyrics on the big screen, a live keyboard and guitar, and the whole room singing. Old classics and recent favourites in Tamil, Hindi and English. No singing skills needed.",
    highlights: ["Live keyboard & guitar", "Lyrics on screen", "Open to all ages", "Request a song at the door"], tags: ["music", "family", "sing-along"] },
  { title: "Unplugged Acoustic Evening", eventType: "concert", time: "19:30", price: 349, maxCapacity: 60,
    description: "An intimate acoustic set by local artists — guitars, cajon and vocals — in a relaxed seated setting.",
    highlights: ["Three-artist line-up", "Seated, 60 seats only", "Two sets with a short break"], tags: ["live music", "acoustic"] },
  { title: "Monsoon Street Carnival", eventType: "carnival", time: "16:00", price: 99, maxCapacity: 250,
    description: "An open-air carnival with games, face painting, a magic show and a bouncy zone for kids, and a small street-food market for everyone else.",
    highlights: ["Kids' games & face painting", "Magic show at 6 PM", "Street-food stalls", "Entry includes 3 game tokens"], tags: ["carnival", "kids", "family"] },
  { title: "Folk Arts Evening: Dance & Drum Showcase", eventType: "cultural", time: "18:30", price: 149, maxCapacity: 150,
    description: "Traditional folk dance and percussion performances by regional troupes, followed by an audience drumming circle.",
    highlights: ["Three folk troupes", "Audience drumming circle", "Photo-friendly stage"], tags: ["culture", "dance", "folk"] },
  { title: "Retro Film Songs: Live Band Night", eventType: "concert", time: "19:00", price: 499, maxCapacity: 120,
    description: "A six-piece live band plays the best film songs of the 80s, 90s and 2000s. Dance floor open.",
    highlights: ["Six-piece live band", "Dance floor", "Two singers"], tags: ["live music", "retro"] },
  { title: "Open Mic & Stand-Up Night", eventType: "openmic", time: "19:00", price: 149, maxCapacity: 70,
    description: "Local comedians and singers take the stage. Want to perform? Sign up at the counter before 6:30 PM — 5 minutes each.",
    highlights: ["Walk-in performer slots", "Stand-up and music", "Hosted by a local comic"], tags: ["comedy", "open mic"] },
  { title: "Kids' Art & Craft Workshop", eventType: "workshop", time: "11:00", price: 249, maxCapacity: 30,
    description: "A two-hour hands-on workshop for ages 6–12: painting, paper craft and clay. All materials provided.",
    highlights: ["All materials included", "Ages 6–12", "Take your creation home"], tags: ["kids", "art", "workshop"] },
  { title: "Classical Evening: Flute & Violin", eventType: "cultural", time: "18:30", price: 299, maxCapacity: 90,
    description: "A calm evening of Carnatic and light-classical music on flute and violin with tabla accompaniment.",
    highlights: ["Flute, violin & tabla", "Seated, 90 seats", "About 90 minutes"], tags: ["classical", "music"] },
  { title: "Family Movie Night Under the Stars", eventType: "screening", time: "19:00", price: 129, maxCapacity: 100,
    description: "A family-friendly movie on a big outdoor screen. Bring a mat or pick a seat from ours.",
    highlights: ["Outdoor big screen", "Family-friendly film", "Open seating"], tags: ["movie", "family"] },
  { title: "Winter Food & Fun Carnival", eventType: "carnival", time: "15:00", price: 149, maxCapacity: 300,
    description: "A day-to-night carnival with rides for kids, games, live DJ music and food stalls.",
    highlights: ["Kids' rides & games", "Live DJ from 6 PM", "Food stalls", "Entry includes 5 game tokens"], tags: ["carnival", "family", "music"] },
];

const iso = (d) => d.toISOString().slice(0, 10);

async function main() {
  const slug = String(opt("restaurant") || "").trim().toLowerCase();
  if (!slug) throw new Error("Pass --restaurant <slug>");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);

  const restaurant = await runAsPlatform(() => Restaurant.findOne({ slug }).lean());
  if (!restaurant) throw new Error(`No restaurant with slug "${slug}"`);

  await runInTenant(restaurant.id, async () => {
    const venue = opt("venue")
      ? await Venue.findOne({ id: opt("venue") }).lean()
      : (await Venue.findOne({ isMainBranch: true }).lean()) || (await Venue.findOne({}).lean());
    if (!venue) throw new Error("No venue found for this restaurant (pass --venue <id>)");

    const Events = getModel("events");
    const Bookings = getModel("eventBookings");
    const venueLine = [venue.address, venue.area].filter(Boolean).join(", ") || venue.name;

    if (flag("replace-existing")) {
      const ids = (await Events.find({ venueId: venue.id }).select("id").lean()).map((e) => e.id);
      if (flag("dry-run")) console.log(`[dry-run] would delete ${ids.length} events and their bookings`);
      else {
        const b = await Bookings.deleteMany({ venueId: venue.id, eventId: { $in: ids } });
        const e = await Events.deleteMany({ venueId: venue.id });
        console.log(`Deleted ${e.deletedCount} events and ${b.deletedCount} bookings.`);
      }
    }

    const existing = new Set((await Events.find({ venueId: venue.id }).select("title").lean()).map((e) => e.title));
    const start = new Date();
    let added = 0;
    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i];
      if (existing.has(ev.title)) { console.log(`skip (exists): ${ev.title}`); continue; }
      const date = new Date(start.getTime() + (10 + i * 7) * 864e5);
      const doc = {
        id: `evt_${crypto.randomBytes(6).toString("hex")}`,
        ...ev,
        date: iso(date),
        bookingCloseDate: iso(new Date(date.getTime() - 2 * 864e5)),
        venueMode: "restaurant",
        venue: venueLine,
        venueId: venue.id,
        images: [], image: "", dishes: [], dishQty: {},
        status: "upcoming", isPublished: true,
      };
      if (flag("dry-run")) console.log(`[dry-run] ${doc.date}  ₹${doc.price}  ${doc.title}`);
      else { await Events.create(doc); added++; console.log(`added: ${doc.date}  ₹${doc.price}  ${doc.title}`); }
    }
    console.log(flag("dry-run") ? "Dry run complete." : `Done — ${added} event(s) added to ${venue.name}.`);
  });
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
