/**
 * Events.js  —  Dishky Admin Panel
 * Events management page
 */

import React, { useState, useMemo, useRef } from "react";

import { exportToExcel, exportMultiSheet } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import { DateRangeGroup, MultiPillGroup } from "../../components/FilterBar";


import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import { EmptyState } from "../../App";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";
import CancelReasonModal from "../../components/CancelReasonModal";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import usePopupAnimation, { MODAL_ANIM_EXIT_DURATION } from "../../hooks/usePopupAnimation";
import CollapseChevron from "../../components/CollapseChevron";
import CollapseSection from "../../components/CollapseSection";
import { useVenue } from "../../context/VenueContext";
import { venueToAddressFields } from "../../utils/resolveVenueAddress";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../../components/InfiniteScrollLoader";

import "../Common.css";
import "./Events.css";
import "../ModalCSS.css";
import { fmtDate as formatDate, fmtTime } from "../../utils/dateUtils";
import { useTabLiquid } from "../../hooks/useTabLiquid";
import AttendeeFields from "../../components/AttendeeFields";
import { compressImage } from "../../utils/imageCompress";
import {
  EVENT_TYPES, eventTypeLabel, EMPTY_ATTENDEES, attendeeTotal, validateAttendees, cleanAttendees,
  normalizeAttendees, genderSummary, groupFamiliesByEvent,
} from "../../utils/eventConfig";
import { toTitleCase } from "../../utils/formUtils";

// ─── helpers ────────────────────────────────────────────────────────────────
const generateId = (name) =>
  `evt_${name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const STATUS_COLORS = {
  upcoming: "#2563eb",
  ongoing: "#16a34a",
  completed: "#6b7280",
  cancelled: "#dc2626",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  eventType: "concert",
  date: "",
  time: "",
  bookingCloseDate: "",
  lastApplyDate: "",
  venueMode: "restaurant",
  venue: "",
  maxCapacity: "",
  price: "",
  images: [],
  tags: [],
  status: "upcoming",
  isPublished: true,
  highlights: [],
  dishes: [],
  dishQty: {},
  selectedCategory: "",
};

const MAX_EVENT_IMAGES = 5;

const EMPTY_BOOKING_FORM = {
  eventId: "", name: "", phone: "", email: "", specialRequests: "", status: "confirmed",
  attendees: { ...EMPTY_ATTENDEES },
};
const phone10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

// ─── Main Component ─────────────────────────────────────────────────────────
const Events = ({ adminData, setAdminData, filters, patchFilters }) => {
  // ── Hooks

  const { toast } = useToast();
  const { currentVenue } = useVenue();
  const events = useMemo(
    () => adminData?.events ?? [],
    [adminData?.events]
  );

  const bookings = useMemo(
    () => adminData?.eventBookings ?? [],
    [adminData?.eventBookings]
  );

  const allDishes = useMemo(() => {
    const cats = adminData?.categories || [];
    const list = [];
    cats.forEach(cat => {
      (cat.subCategories || []).forEach(sub => {
        (sub.dishes || []).forEach(d => list.push({ ...d, subCat: sub.name, cat: cat.name }));
      });
      (cat.dishes || []).forEach(d => list.push({ ...d, subCat: cat.name, cat: cat.name }));
    });
    return list;
  }, [adminData]);

  // Destructure persisted filter state from App
  const { activeTab, filterEventId, filterStatuses, filterFromDate, filterToDate, searchQuery,
    bookingsDatePreset,
    evtSearch, evtFilterStatuses, evtFilterTypes, evtFilterPublish, evtFromDate, evtToDate, evtDatePreset } = filters;

  // ── Helpers

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const setActiveTab = (v) => patchFilters({ activeTab: v });
  const { containerRef: evtTabPillsRef, thumbStyle: evtTabThumbStyle } = useTabLiquid(activeTab);
  const setFilterEventId = (v) => patchFilters({ filterEventId: v });
  const setFilterStatuses = (v) => patchFilters({ filterStatuses: typeof v === "function" ? v(filterStatuses) : v });
  const setFilterFromDate = (v) => patchFilters({ filterFromDate: v });
  const setFilterToDate = (v) => patchFilters({ filterToDate: v });
  const setBookingsDatePreset = (v) => patchFilters({ bookingsDatePreset: v });
  const setSearchQuery = (v) => patchFilters({ searchQuery: v });
  const setEvtSearch = (v) => patchFilters({ evtSearch: v });
  const setEvtFilterStatuses = (v) => patchFilters({ evtFilterStatuses: typeof v === "function" ? v(evtFilterStatuses) : v });
  const setEvtFilterTypes = (v) => patchFilters({ evtFilterTypes: typeof v === "function" ? v(evtFilterTypes) : v });
  const setEvtFilterPublish = (v) => patchFilters({ evtFilterPublish: typeof v === "function" ? v(evtFilterPublish) : v });
  const setEvtFromDate = (v) => patchFilters({ evtFromDate: v });
  const setEvtToDate = (v) => patchFilters({ evtToDate: v });
  const setEvtDatePreset = (v) => patchFilters({ evtDatePreset: v });


  const [showForm, setShowForm] = useState(false);
  const formModal = useAnimatedModal("events-createEdit");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormStep, setEditFormStep] = useState(1);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [tagInput, setTagInput] = useState("");
  const [highlightInput, setHighlightInput] = useState("");
  const [viewBooking, setViewBooking] = useState(null);
  const bookingDetailModal = useAnimatedModal("events-bookingDetail");
  const cancelBookingPopup = usePopupAnimation({
    duration: MODAL_ANIM_EXIT_DURATION,
    inClass: "modal-anim-in",
    outClass: "modal-anim-out",
  });
  const [addGuestAtt, setAddGuestAtt] = useState({ male: 0, female: 0, third: 0, kids: 0, seniors: 0, physicallyChallenged: 0 });
  const [bookView, setBookView] = useState("families");
  const [openFamilies, setOpenFamilies] = useState(() => new Set());
  const addBookingModal = useAnimatedModal("events-addBooking");
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM);
  const [bookingErrors, setBookingErrors] = useState({});
  const [bookingSaving, setBookingSaving] = useState(false);
  const [addGuestSaving, setAddGuestSaving] = useState(false);

  // Booking table sorting — local only, no need to persist
  const [bookSortKey, setBookSortKey] = useState("bookedAt");
  const [bookSortDir, setBookSortDir] = useState("desc");

  const fileInputRef = useRef();

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (filterEventId !== "all") list = list.filter((b) => b.eventId === filterEventId);
    if (filterStatuses.size > 0) list = list.filter((b) => filterStatuses.has(b.status || "pending"));
    if (filterFromDate) list = list.filter((b) => {
      const d = (b.bookedAt || b.date || "").slice(0, 10);
      return d >= filterFromDate;
    });
    if (filterToDate) list = list.filter((b) => {
      const d = (b.bookedAt || b.date || "").slice(0, 10);
      return d <= filterToDate;
    });
    if (searchQuery.trim())
      list = list.filter(
        (b) =>
          b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.phone?.includes(searchQuery)
      );

    return [...list].sort((a, b) => {
      const aVal = String(a[bookSortKey] ?? "").toLowerCase();
      const bVal = String(b[bookSortKey] ?? "").toLowerCase();
      return bookSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [bookings, filterEventId, filterStatuses, filterFromDate, filterToDate, searchQuery, bookSortKey, bookSortDir]);

  const { displayLimit: bookingsDisplayLimit, sentinelRef: bookingsSentinelRef, containerRef: bookingsContainerRef, hasMore: bookingsHasMore, isLoadingMore: bookingsIsLoadingMore } =
    useInfiniteScroll(filteredBookings.length, 20);

  // Families per event, built from the filtered bookings so every filter above
  // (event, status, dates, search) also narrows the family list and its download.
  const eventFamilies = useMemo(() => {
    const byEvent = groupFamiliesByEvent(filteredBookings);
    return [...byEvent.entries()]
      .map(([eventId, families]) => ({ eventId, evt: events.find((e) => e.id === eventId), families }))
      .sort((a, b) => String(a.evt?.date || "").localeCompare(String(b.evt?.date || "")));
  }, [filteredBookings, events]);

  const toggleFamily = (key) =>
    setOpenFamilies((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  const toggleBookSort = (key) => {
    if (bookSortKey === key) setBookSortDir(d => d === "asc" ? "desc" : "asc");
    else { setBookSortKey(key); setBookSortDir("asc"); }
  };

  const filteredEvents = useMemo(() => {
    let list = events;
    if (evtSearch.trim()) {
      const q = evtSearch.toLowerCase();
      list = list.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.venue || "").toLowerCase().includes(q) ||
        (e.categoryLabel || e.eventType || "").toLowerCase().includes(q)
      );
    }
    if (evtFilterStatuses.size > 0) {
      list = list.filter(e => evtFilterStatuses.has(e.status));
    }
    if (evtFilterTypes.size > 0) list = list.filter(e => evtFilterTypes.has(e.eventType || "") || evtFilterTypes.has((e.categoryLabel || "").toLowerCase()));
    if (evtFilterPublish.size > 0 && !(evtFilterPublish.has("live") && evtFilterPublish.has("draft"))) {
      if (evtFilterPublish.has("live")) list = list.filter(e => e.isPublished);
      else if (evtFilterPublish.has("draft")) list = list.filter(e => !e.isPublished);
    }
    if (evtFromDate) list = list.filter(e => (e.date || "") >= evtFromDate);
    if (evtToDate) list = list.filter(e => (e.date || "") <= evtToDate);
    return list;
  }, [events, evtSearch, evtFilterStatuses, evtFilterTypes, evtFilterPublish, evtFromDate, evtToDate]);

  const exportEvents = () => {
    if (!filteredEvents.length) { toast.warning("No events to export"); return; }
    const rows = filteredEvents.map(evt => {
      const stats = statsForEvent(evt.id);
      return {
        Title: evt.title || "—",
        Type: eventTypeLabel(evt.eventType),
        Date: formatDate(evt.date),
        Time: fmtTime(evt.time),
        Venue: evt.venue || "—",
        "Max Capacity": evt.maxCapacity || 0,
        "Price (₹)": evt.price || 0,
        "Total Bookings": stats.total,
        Confirmed: stats.confirmed,
        Pending: stats.pending,
        Status: evt.status || "—",
        Published: evt.isPublished ? "Live" : "Draft",
      };
    });
    exportToExcel({ rows, sheetName: "Events", fileName: `events_${new Date().toISOString().slice(0, 10)}.xlsx` });
  };

  const dateSuffix = () => filterFromDate && filterToDate
    ? `${filterFromDate}_to_${filterToDate}`
    : new Date().toISOString().slice(0, 10);

  // One row per booking, with the persons breakdown.
  const exportBookings = () => {
    if (!filteredBookings.length) { toast.warning("No bookings to export"); return; }
    const rows = filteredBookings.map((b) => {
      const evt = events.find((e) => e.id === b.eventId);
      const a = normalizeAttendees(b);
      return {
        Name: b.name || "—",
        Email: b.email || "—",
        Phone: b.phone || "—",
        Event: evt?.title || b.eventId || "—",
        "Booked On": formatDate(b.bookedAt || b.date),
        "Total Persons": b.guests ?? "—",
        Male: a.male, Female: a.female, "Third Gender": a.third, "Not Specified": a.unspecified,
        Kids: a.kids, Elderly: a.seniors, "Physically Challenged": a.physicallyChallenged,
        Amount: b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—",
        Status: b.status || "—",
      };
    });
    exportToExcel({ rows, sheetName: "Event Bookings", fileName: `event_bookings_${dateSuffix()}.xlsx` });
  };

  // Complete family-wise list (respects the filters currently applied).
  // Sheet 1: every booking, grouped by event → family. Sheet 2: one row per family.
  const exportFamilyList = () => {
    if (!eventFamilies.length) { toast.warning("No bookings to export"); return; }
    const listRows = [];
    const summaryRows = [];
    eventFamilies.forEach(({ evt, families }) => {
      families.forEach((f) => {
        summaryRows.push({
          Event: evt?.title || f.eventId, "Event Date": formatDate(evt?.date),
          "Family No.": f.no, "Family Head": f.head, "Booked Via": f.isAccount ? "Account / Guest account" : "Added by admin",
          Phone: f.phone || "—", Email: f.email || "—",
          Bookings: f.activeCount, "Total Persons": f.persons,
          Male: f.male, Female: f.female, "Third Gender": f.third, "Not Specified": f.unspecified,
          Kids: f.kids, Elderly: f.seniors, "Physically Challenged": f.physicallyChallenged,
          "Amount (₹)": f.amount, Status: f.status,
        });
        f.bookings.forEach((b) => {
          const a = normalizeAttendees(b);
          listRows.push({
            Event: evt?.title || f.eventId, "Event Date": formatDate(evt?.date),
            "Family No.": f.no, "Family Head": f.head,
            Name: b.name || "—", Phone: b.phone || "—", Email: b.email || "—",
            "Booking ID": b.id, "Booked On": formatDate(b.bookedAt || b.date), Status: b.status || "—",
            "Total Persons": Number(b.guests) || 1,
            Male: a.male, Female: a.female, "Third Gender": a.third, "Not Specified": a.unspecified,
            Kids: a.kids, Elderly: a.seniors, "Physically Challenged": a.physicallyChallenged,
            "Amount (₹)": Number(b.totalAmount) || 0, "Special Requests": b.specialRequests || "",
          });
        });
      });
    });
    exportMultiSheet({
      sheets: [{ name: "Family List", rows: listRows }, { name: "Family Summary", rows: summaryRows }],
      fileName: `event_family_list_${dateSuffix()}.xlsx`,
    });
  };

  const BookSortIcon = ({ col }) => (
    <span className="sort-arrow">
      {bookSortKey === col ? (bookSortDir === "asc" ? "▲" : "▼") : ""}
    </span>
  );

  const statsForEvent = (eventId) => ({
    total: bookings.filter((b) => b.eventId === eventId).length,
    confirmed: bookings.filter((b) => b.eventId === eventId && b.status === "confirmed").length,
    pending: bookings.filter((b) => b.eventId === eventId && b.status === "pending").length,
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const deleteConfirmModal = useAnimatedModal("events-deleteConfirm");


  const resetForm = () => {
    formModal.close(() => setShowForm(false));
    setIsEditMode(false);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setTagInput("");
    setHighlightInput("");
    setEditFormStep(1);
  };

  const restaurantVenueLine = () => venueToAddressFields(currentVenue).venue || "";

  const openAdd = () => {
    setFormData({ ...EMPTY_FORM, venue: restaurantVenueLine() });
    setIsEditMode(false);
    setFormErrors({});
    setEditFormStep(1);
    setShowForm(true);
    formModal.open();
  };

  const openEdit = (evt) => {
    setFormData({
      ...EMPTY_FORM, ...evt,
      venueMode: evt.venueMode || (evt.venue && evt.venue !== restaurantVenueLine() ? "custom" : "restaurant"),
      images: evt.images || (evt.image ? [evt.image] : []),
    });
    setIsEditMode(true);
    setEditFormStep(1);
    setShowForm(true);
    formModal.open();
  };

  const handleImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow picking the same file again
    if (!files.length) return;
    const room = MAX_EVENT_IMAGES - (formData.images?.length || 0);
    if (room <= 0) { toast.warning(`You can add up to ${MAX_EVENT_IMAGES} images per event.`); return; }
    if (files.length > room) toast.warning(`Only ${room} more image${room !== 1 ? "s" : ""} can be added (max ${MAX_EVENT_IMAGES}).`);
    const results = await Promise.allSettled(files.slice(0, room).map((f) => compressImage(f)));
    const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    if (results.some((r) => r.status === "rejected")) toast.error("Some files could not be read as images.");
    if (ok.length) setFormData((p) => ({ ...p, images: [...(p.images || []), ...ok].slice(0, MAX_EVENT_IMAGES) }));
  };

  const removeImage = (idx) => {
    setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  const validateEvtStep = (step) => {
    const e = {};
    if (step === 1) {
      if (!formData.title.trim()) e.title = true;
      if (!formData.date) e.date = true;
    }
    if (step === 2) {
      if (!formData.venue?.trim()) e.venue = true;
      if (!formData.maxCapacity || Number(formData.maxCapacity) < 1) e.maxCapacity = true;
    }
    if (step === 3) {
      if (!formData.description?.trim()) e.description = true;
    }
    setFormErrors(prev => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.date) {
      toast.error("Title and Date are required.");
      return;
    }
    if (!formData.venue?.trim() || !formData.maxCapacity || Number(formData.maxCapacity) < 1) {
      toast.error("Venue and capacity are required.");
      setEditFormStep(2);
      return;
    }
    if (!formData.description?.trim()) {
      toast.error("Description is required.");
      setEditFormStep(3);
      return;
    }
    if (Number(formData.price) < 0) {
      toast.error("Price per person cannot be negative.");
      setEditFormStep(2);
      return;
    }
    // FIX: always use string ID for new events to avoid lodash-id 500 errors
    const payload = {
      ...formData,
      id: isEditMode ? formData.id : generateId(formData.title),
      image: formData.images?.[0] || "",
      maxCapacity: Number(formData.maxCapacity) || 0,
      price: Number(formData.price) || 0,
    };

    try {
      if (isEditMode) {
        await api.put(`/events/${payload.id}`, payload);
        setAdminData((p) => ({
          ...p,
          events: p.events.map((e) => (e.id === payload.id ? payload : e)),
        }));
        toast.success("Event updated successfully.");
      } else {
        await api.post("/events", payload);
        // Use local payload (not res.data) to avoid duplicates when adminData re-fetches
        setAdminData((p) => {
          const existing = p.events || [];
          // Deduplicate: if somehow ID already present, replace it
          const deduped = existing.filter(e => e.id !== payload.id);
          return { ...p, events: [...deduped, payload] };
        });
        toast.success("Event created successfully.");
      }
      resetForm();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save event. Please try again.");
    }
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    deleteConfirmModal.close(() => setConfirmDeleteId(null));
    // Optimistic update first — remove from UI immediately
    const snapshot = adminData.events || [];
    const bookingsSnapshot = adminData.eventBookings || [];
    setAdminData((p) => ({
      ...p,
      events: (p.events || []).filter((e) => String(e.id) !== String(id)),
      eventBookings: (p.eventBookings || []).filter((b) => String(b.eventId) !== String(id)),
    }));
    try {
      await api.delete(`/events/${id}`);
      toast.success("Event deleted.");
    } catch (err) {
      console.error("Delete failed:", err);
      // Rollback on failure
      setAdminData((p) => ({
        ...p,
        events: snapshot,
        eventBookings: bookingsSnapshot,
      }));
      toast.error("Failed to delete event. Please try again.");
    }
  };

  const handleTogglePublish = async (evt) => {
    const updated = { ...evt, isPublished: !evt.isPublished };
    try {
      await api.put(`/events/${evt.id}`, updated);
      setAdminData((p) => ({
        ...p,
        events: p.events.map((e) => (e.id === evt.id ? updated : e)),
      }));
      toast.success(updated.isPublished ? "Event published." : "Event unpublished.");
    } catch (err) {
      console.error("Toggle publish failed:", err);
      toast.error("Failed to update event. The event may have an invalid ID format.");
    }
  };

  const handleBookingStatus = async (bookingId, newStatus) => {
    if (newStatus === "cancelled") {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      cancelBookingPopup.open(booking);
      return;
    }
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const updated = { ...booking, status: newStatus };
    try {
      await api.put(`/eventBookings/${bookingId}`, updated);
      setAdminData((p) => ({
        ...p,
        eventBookings: p.eventBookings.map((b) => (b.id === bookingId ? updated : b)),
      }));
      if (viewBooking?.id === bookingId) setViewBooking(updated);
    } catch (err) {
      toast.error("Failed to update booking status.");
    }
  };

  const handleBookingCancelConfirm = async (reason) => {
    const booking = cancelBookingPopup.data;
    if (!booking) return;
    const cancelledAt = new Date().toISOString();
    const updated = { ...booking, status: "cancelled", cancelReason: reason, cancelledAt };
    try {
      await api.put(`/eventBookings/${booking.id}`, updated);
      setAdminData((p) => ({
        ...p,
        eventBookings: p.eventBookings.map((b) => (b.id === booking.id ? updated : b)),
      }));
      if (viewBooking?.id === booking.id) setViewBooking(updated);
      toast.success("Booking cancelled.");
    } catch (err) {
      toast.error("Failed to cancel booking.");
      throw err;
    }
  };

  // Seats still free on an event (null = no capacity set). Cancelled bookings don't hold seats.
  const seatsLeftFor = (evt) => {
    const max = Number(evt?.maxCapacity) || 0;
    if (!max) return null;
    const used = bookings
      .filter((b) => b.eventId === evt.id && b.status !== "cancelled")
      .reduce((sum, b) => sum + (Number(b.guests) || 1), 0);
    return Math.max(0, max - used);
  };

  const handleAddGuests = async (bookingId, att) => {
    const attErr = validateAttendees(att);
    if (attErr) { toast.error(attErr); return; }
    const extra = attendeeTotal(att);
    setAddGuestSaving(true);
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      const evt = (adminData?.events || []).find(e => e.id === booking.eventId);
      const left = seatsLeftFor(evt);
      if (left !== null && extra > left) { toast.error(`Only ${left} seat${left !== 1 ? "s" : ""} left on this event.`); return; }
      const pricePerGuest = Number(evt?.price || 0);
      const newGuests = (Number(booking.guests) || 1) + extra;
      const old = normalizeAttendees(booking);
      const merged = cleanAttendees({
        male: old.male + att.male, female: old.female + att.female, third: old.third + att.third,
        kids: old.kids + att.kids, seniors: old.seniors + att.seniors,
        physicallyChallenged: old.physicallyChallenged + att.physicallyChallenged,
      });
      const updated = { ...booking, guests: newGuests, attendees: merged, totalAmount: newGuests * pricePerGuest };
      await api.put(`/eventBookings/${bookingId}`, updated);
      setAdminData((p) => ({
        ...p,
        eventBookings: p.eventBookings.map((b) => (b.id === bookingId ? updated : b)),
      }));
      setViewBooking(updated);
      setAddGuestAtt({ male: 0, female: 0, third: 0, kids: 0, seniors: 0, physicallyChallenged: 0 });
      toast.success("Persons added to the booking.");
    } catch (err) {
      console.error("Add guests failed", err);
      toast.error("Failed to update the booking. Please try again.");
    } finally {
      setAddGuestSaving(false);
    }
  };

  // ── Add booking from the admin panel ──
  const bookableEvents = useMemo(
    () => events.filter((e) => e.status !== "cancelled" && e.status !== "completed"),
    [events]
  );
  const bookingEvent = events.find((e) => e.id === bookingForm.eventId);
  const bookingSeatsLeft = bookingEvent ? seatsLeftFor(bookingEvent) : null;
  const bookingTotal = attendeeTotal(bookingForm.attendees);
  const bookingAmount = bookingTotal * (Number(bookingEvent?.price) || 0);
  // Same phone on the same event → this booking joins that family.
  const matchingFamily = useMemo(() => {
    const ph = phone10(bookingForm.phone);
    if (!bookingForm.eventId || ph.length !== 10) return null;
    const fams = groupFamiliesByEvent(bookings.filter((b) => b.eventId === bookingForm.eventId)).get(bookingForm.eventId) || [];
    return fams.find((f) => f.bookings.some((b) => phone10(b.phone) === ph)) || null;
  }, [bookings, bookingForm.eventId, bookingForm.phone]);

  const openAddBooking = (eventId) => {
    setBookingForm({ ...EMPTY_BOOKING_FORM, attendees: { ...EMPTY_ATTENDEES }, eventId: eventId && eventId !== "all" ? eventId : "" });
    setBookingErrors({});
    addBookingModal.open();
  };

  const closeAddBooking = () => addBookingModal.close(() => setBookingErrors({}));

  const handleCreateBooking = async () => {
    const errs = {};
    if (!bookingForm.eventId) errs.eventId = "Choose an event.";
    if (!bookingForm.name.trim()) errs.name = "Enter the name.";
    if (phone10(bookingForm.phone).length !== 10) errs.phone = "Enter a valid 10-digit phone number.";
    if (bookingForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingForm.email.trim())) errs.email = "Enter a valid email address.";
    const attErr = validateAttendees(bookingForm.attendees);
    if (attErr) errs.attendees = attErr;
    else if (bookingSeatsLeft !== null && bookingTotal > bookingSeatsLeft)
      errs.attendees = bookingSeatsLeft === 0 ? "This event is fully booked." : `Only ${bookingSeatsLeft} seat${bookingSeatsLeft !== 1 ? "s" : ""} left.`;
    setBookingErrors(errs);
    if (Object.keys(errs).length) return;

    const now = new Date().toISOString();
    const payload = {
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eventId: bookingForm.eventId,
      name: bookingForm.name.trim(),
      phone: phone10(bookingForm.phone),
      email: bookingForm.email.trim(),
      guests: bookingTotal,
      attendees: cleanAttendees(bookingForm.attendees),
      specialRequests: bookingForm.specialRequests.trim(),
      totalAmount: bookingAmount,
      status: bookingForm.status,
      source: "Admin Panel",
      bookedAt: now, createdAt: now, updatedAt: now,
    };
    setBookingSaving(true);
    try {
      const res = await api.post("/eventBookings", payload);
      const saved = res?.data?.id ? res.data : payload;
      setAdminData((p) => {
        const list = p.eventBookings || [];
        return { ...p, eventBookings: list.some((b) => b.id === saved.id) ? list : [...list, saved] };
      });
      toast.success("Booking added.");
      closeAddBooking();
    } catch (err) {
      console.error("Add booking failed", err);
      toast.error("Failed to add booking. Please try again.");
    } finally {
      setBookingSaving(false);
    }
  };

  const toggleDish = (dishId) => {
    setFormData(p => {
      const dishes = p.dishes || [];
      const dishQty = { ...(p.dishQty || {}) };
      if (dishes.includes(dishId)) {
        delete dishQty[dishId];
        return { ...p, dishes: dishes.filter(d => d !== dishId), dishQty };
      }
      dishQty[dishId] = 1;
      return { ...p, dishes: [...dishes, dishId], dishQty };
    });
  };

  // ── Category-based Dish Selector ──
  const DishSelector = ({ selectedDishes, onToggle, activeCat, onCatChange, hideSelectedTable = false, dishQty = {}, guests = 1 }) => {
    const categories = adminData?.categories || [];
    const catObj = categories.find(c => c.id === activeCat);
    let catDishes = [];
    if (catObj) {
      if (catObj.subCategories?.length) {
        catObj.subCategories.forEach(sub => {
          (sub.dishes || []).forEach(d => catDishes.push({ ...d, subCat: sub.name }));
        });
      }
      (catObj.dishes || []).forEach(d => catDishes.push({ ...d, subCat: catObj.name }));
    } else {
      // No category selected → show all dishes across all categories
      categories.forEach(cat => {
        if (cat.subCategories?.length) {
          cat.subCategories.forEach(sub => {
            (sub.dishes || []).forEach(d => catDishes.push({ ...d, subCat: sub.name }));
          });
        }
        (cat.dishes || []).forEach(d => catDishes.push({ ...d, subCat: cat.name }));
      });
    }
    const selectedDetails = (selectedDishes || []).map(id => allDishes.find(d => d.id === id)).filter(Boolean);
    const effectiveQty = (id) => dishQty[id] ?? guests ?? 1;
    const dishesTotalPrice = selectedDetails.reduce((sum, d) => sum + Number(d.basePrice || 0) * effectiveQty(d.id), 0);

    const isSelected = (id) => (selectedDishes || []).includes(id);

    return (
      <div className="ae-dish-selector-v2">
        <CustomDropdown
          value={activeCat}
          onChange={onCatChange}
          options={[
            { value: "", label: "All Categories" },
            ...categories.map(cat => ({ value: cat.id, label: cat.name })),
          ]}
        />

        {catDishes.length > 0 && (
          <div className="act-dish-grid">
            {catDishes.map(dish => {
              const sel = isSelected(dish.id);
              return (
                <div key={dish.id} className={`act-dish-card${sel ? " selected" : ""}`}>
                  <div className="act-dish-info">
                    <span className="act-dish-name">{dish.name}</span>
                    {dish.subCat && <span className="act-dish-cat">{dish.subCat}</span>}
                    <span className="act-dish-price">₹{dish.basePrice}</span>
                  </div>
                  {sel ? (
                    <Button3D iconOnly onClick={() => onToggle(dish.id)}>✓ Added</Button3D>
                  ) : (
                    <Button3D variant="cancel" iconOnly onClick={() => onToggle(dish.id)}>+ Add</Button3D>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {catDishes.length === 0 && <p className="ae-dish-empty" style={{ textAlign: "center", padding: "24px 0" }}>No dishes available.</p>}

        {selectedDetails.length > 0 && !hideSelectedTable && (
          <div className="ae-selected-dishes-table">
            <div className="ae-sdt-header">
              <span>Selected Menu Dishes</span>
              <span>{selectedDetails.length} dish(es) · Food Total: <strong>₹{dishesTotalPrice.toLocaleString("en-IN")}</strong></span>
            </div>
            <table className="ae-sdt">
              <thead>
                <tr><th className="icon-width">#</th><th>Dish</th><th>Category</th><th>Qty (guests)</th><th>Price</th><th></th></tr>
              </thead>
              <tbody>
                {selectedDetails.map((d, i) => (
                  <tr key={d.id}>
                    <td className="icon-width">{i + 1}</td>
                    <td><div className="ae-sdt-dish"><span>{d.name}</span></div></td>
                    <td className="ae-sdt-cat">{d.subCat || d.cat || "—"}</td>
                    <td style={{ textAlign: "center" }}>{effectiveQty(d.id)}</td>
                    <td className="ae-sdt-price">₹{(Number(d.basePrice || 0) * effectiveQty(d.id)).toLocaleString("en-IN")}</td>
                    <td><button type="button" className="ae-sdt-remove" onClick={() => onToggle(d.id)} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Remove">×</button></td>
                  </tr>
                ))}
                <tr className="ae-sdt-total-row">
                  <td colSpan="4"><strong>Food Total</strong></td>
                  <td colSpan="2"><strong>₹{dishesTotalPrice.toLocaleString("en-IN")}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const ImageUploadBlock = ({ images, onUpload, onRemove, inputRef }) => (
    <div className="ae-image-upload-block">
      <div className="ae-image-thumbs">
        {(images || []).map((img, i) => (
          <div key={i} className="ae-image-thumb">
            <img src={img} alt={`img-${i}`} />
            <button type="button" className="ae-thumb-remove" onClick={() => onRemove(i)}>×</button>
          </div>
        ))}
        <label className="ae-image-add-btn" onClick={() => inputRef.current?.click()}>+ Add</label>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onUpload(e)} />
    </div>
  );

  return (
    <div className="inner-page evt-page">
      {/* PAGE HEADER */}
      <div className="evt-header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="evt-title">Events</h2>
              <span className="result-count">
                {activeTab === "events"
                  ? `${filteredEvents.length} event(s)`
                  : `${filteredBookings.length} result(s)`}
              </span>
            </div>
            <p className="evt-subtitle">Manage restaurant events &amp; track bookings</p>
          </div>
        </div>
        <div className="ae-header-actions">
          <div className="app-tab-pills" ref={evtTabPillsRef}>
            <span className="app-tab-pill-liquid" style={evtTabThumbStyle} />
            <button className={`app-tab-pill ${activeTab === "events" ? "active" : ""}`} onClick={() => setActiveTab("events")}>
              Events
              <span className="ae-badge">{filteredEvents.length}/{events.length}</span>
            </button>
            <button className={`app-tab-pill ${activeTab === "bookings" ? "active" : ""}`} onClick={() => setActiveTab("bookings")}>
              Bookings
              <span className="ae-badge ae-badge-purple">{filteredBookings.length}/{bookings.length}</span>
            </button>
          </div>
          {activeTab === "events" && (
            <div className="ae-btn-group">
              <Button3D onClick={openAdd}>Create Event</Button3D>
            </div>
          )}
        </div>
      </div>

      {/* EVENTS TAB */}
      {activeTab === "events" && (
        <>
          {/* EVENTS FILTER BAR */}
          <CollapseSection collapsed={headerCollapsed}>
            <div className="filter-bar">
              <div className="ae-events-filter-top">
                <input
                  className="search-input"
                  placeholder=" Search title, venue, type…"
                  value={evtSearch}
                  onChange={e => setEvtSearch(allowTextInput(evtSearch, e.target.value, 100, 5))}
                />
                <Button3D onClick={exportEvents}>Export</Button3D>
              </div>
              <div className="filter-groups">
                {/* Status */}
                <MultiPillGroup
                  label="Status"
                  labelClass="ae-filter-group-label"
                  options={[
                    ["upcoming", "Upcoming"],
                    ["ongoing", "Ongoing"],
                    ["completed", "Completed"],
                    ["cancelled", "Cancelled"],
                  ]}
                  value={evtFilterStatuses}
                  onToggle={(key) => toggleSet(setEvtFilterStatuses, key)}
                />
                {/* Date quick presets + range */}
                <DateRangeGroup
                  from={evtFromDate}
                  to={evtToDate}
                  onChangeFrom={setEvtFromDate}
                  onChangeTo={setEvtToDate}
                  preset={evtDatePreset}
                  onChangePreset={setEvtDatePreset}
                  presets={[["all", "All"], ["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]]}
                  labelClass="ae-filter-group-label"
                  noMax
                />
                {/* Type */}
                <MultiPillGroup
                  label="Type"
                  labelClass="ae-filter-group-label"
                  options={EVENT_TYPES.map(t => [t.id, t.label])}
                  value={evtFilterTypes}
                  onToggle={(key) => toggleSet(setEvtFilterTypes, key)}
                />
                {/* Publish */}
                <MultiPillGroup
                  label="Publish"
                  labelClass="ae-filter-group-label"
                  options={[["live", "Live"], ["draft", "Draft"]]}
                  value={evtFilterPublish}
                  onToggle={(key) => toggleSet(setEvtFilterPublish, key)}
                />
                {/* Clear + count */}
                {(evtSearch || evtFilterStatuses.size > 0 || evtFilterTypes.size > 0 || evtFilterPublish.size > 0 || evtFromDate || evtToDate) && (
                  <button className="ae-clear-filter" onClick={() => {
                    setEvtSearch(""); setEvtFilterStatuses(new Set());
                    setEvtFilterTypes(new Set()); setEvtFilterPublish(new Set());
                    setEvtFromDate(""); setEvtToDate(""); setEvtDatePreset("");
                  }}>Clear</button>
                )}
              </div>
            </div>
          </CollapseSection>

          <div className="ae-events-scroll">
            {filteredEvents.length === 0 ? (
              <EmptyState message={events.length === 0 ? "No events yet. Create your first event!" : "No events match the current filters."} />
            ) : (
              <div className="ae-events-grid">
                {filteredEvents.map((evt) => {
                  const stats = statsForEvent(evt.id);
                  const pct = evt.maxCapacity
                    ? Math.min(100, Math.round((stats.confirmed / evt.maxCapacity) * 100))
                    : 0;
                  const images = evt.images?.length ? evt.images : (evt.image ? [evt.image] : []);
                  return (
                    <div className="ae-event-card" key={evt.id}>
                      <div className="ae-event-card-image">
                        {images.length > 0 ? (
                          <div className="ae-card-carousel">
                            {images.map((img, i) => (
                              <img key={i} src={img} alt={evt.title} className={i === 0 ? "active" : ""} />
                            ))}
                            {images.length > 1 && <span className="ae-img-count">+{images.length - 1}</span>}
                          </div>
                        ) : (
                          <div className="ae-event-card-placeholder">Event</div>
                        )}
                        <span className="ae-status-badge" style={{ background: STATUS_COLORS[evt.status] }}>
                          {evt.status}
                        </span>
                        <span className={`ae-publish-dot ${evt.isPublished ? "published" : "draft"}`}>
                          {evt.isPublished ? "Live" : "Draft"}
                        </span>
                      </div>

                      <div className="ae-event-card-body">
                        <div className="ae-event-type-tag">{eventTypeLabel(evt.eventType)}</div>
                        <h3 className="ae-event-title">{evt.title}</h3>
                        <p className="ae-event-desc">{evt.description}</p>

                        <div className="ae-event-meta">
                          <span>{formatDate(evt.date)}</span>
                          {evt.time && <span>{fmtTime(evt.time)}</span>}
                          {evt.venue && <span>{evt.venue}</span>}
                          <span>{evt.price === 0 || !evt.price ? "Free entry" : `₹${Number(evt.price).toLocaleString("en-IN")} / person`}</span>
                        </div>

                        {evt.dishes?.length > 0 && (
                          <div className="ae-event-dishes-preview">
                            {evt.dishes.length} dish(es) on menu
                          </div>
                        )}

                        {evt.maxCapacity > 0 && (
                          <div className="ae-capacity-bar">
                            <div className="ae-capacity-label">
                              <span>Capacity</span>
                              <span>{stats.confirmed}/{evt.maxCapacity} confirmed</span>
                            </div>
                            <div className="ae-progress-track">
                              <div className="ae-progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? "#dc2626" : pct >= 60 ? "#f59e0b" : "#16a34a" }} />
                            </div>
                          </div>
                        )}

                        <div className="ae-mini-stats">
                          <div className="ae-mini-stat"><span className="ae-mini-val">{stats.total}</span><span className="ae-mini-label">Total</span></div>
                          <div className="ae-mini-stat"><span className="ae-mini-val" style={{ color: "#16a34a" }}>{stats.confirmed}</span><span className="ae-mini-label">Confirmed</span></div>
                          <div className="ae-mini-stat"><span className="ae-mini-val" style={{ color: "#f59e0b" }}>{stats.pending}</span><span className="ae-mini-label">Pending</span></div>
                        </div>
                      </div>

                      <div className="ae-event-card-footer">
                        <button className="ae-card-btn ae-view-btn" onClick={() => { setFilterEventId(evt.id); setActiveTab("bookings"); }}>View Bookings</button>
                        <button className="ae-card-btn ae-edit-btn" onClick={() => openEdit(evt)}>Edit</button>
                        <button className={`ae-card-btn ae-publish-btn ${evt.isPublished ? "unpublish" : "publish"}`} onClick={() => handleTogglePublish(evt)}>
                          {evt.isPublished ? "Unpublish" : "Publish"}
                        </button>
                        <button className="ae-card-btn ae-delete-btn" onClick={() => { setConfirmDeleteId(evt.id); deleteConfirmModal.open(); }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* BOOKINGS TAB */}
      {activeTab === "bookings" && (
        <div className="admin-events-page">
          {!headerCollapsed && (
            <div className="filter-bar">
              <div className="ae-events-filter-top">
                <input type="text" placeholder="Search by name, email or phone…" className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(allowTextInput(searchQuery, e.target.value, 100, 5))} />

                <div className="ae-bookings-actions">
                  <div className="ae-seg" role="tablist" aria-label="Bookings view">
                    <button type="button" className={bookView === "families" ? "active" : ""} onClick={() => setBookView("families")}>Families</button>
                    <button type="button" className={bookView === "bookings" ? "active" : ""} onClick={() => setBookView("bookings")}>All bookings</button>
                  </div>
                  <Button3D onClick={() => openAddBooking(filterEventId)}>Add Booking</Button3D>
                  <Button3D variant="cancel" onClick={exportFamilyList}>Download Family List</Button3D>
                  <Button3D variant="cancel" onClick={exportBookings}>Export</Button3D>
                </div>

                <DateRangeGroup
                  from={filterFromDate}
                  to={filterToDate}
                  onChangeFrom={setFilterFromDate}
                  onChangeTo={setFilterToDate}
                  preset={bookingsDatePreset}
                  onChangePreset={setBookingsDatePreset}
                  presets={[["all", "All"], ["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]]}
                  periodLabel="period"
                  showPresets
                  noMax
                />
              </div>

              <div className="filter-groups">
                <div className="filter-group">
                  <span className="filter-group-label">Event</span>
                  <CustomDropdown
                    value={filterEventId}
                    onChange={setFilterEventId}
                    options={[
                      { value: "all", label: "All Events" },
                      ...events.map(e => ({ value: e.id, label: e.title })),
                    ]}
                  />
                </div>

                {/* Status pills */}
                <MultiPillGroup
                  label="Status"
                  options={[
                    ["pending", "P", "clb-status-pending", "Pending"],
                    ["confirmed", "C", "clb-status-confirmed", "Confirmed"],
                    ["cancelled", "X", "clb-status-cancelled", "Cancelled"],
                  ]}
                  value={filterStatuses}
                  onToggle={(key) => toggleSet(setFilterStatuses, key)}
                />

                {(filterEventId !== "all" || filterStatuses.size > 0 || searchQuery || filterFromDate || filterToDate) && (
                  <button className="evt-clb-clear-btn" onClick={() => {
                    setFilterEventId("all"); setFilterStatuses(new Set());
                    setSearchQuery(""); setFilterFromDate(""); setFilterToDate("");
                  }}>Clear</button>
                )}

              </div>
            </div>
          )}

          {bookView === "families" && (
            <div className="ae-fam-scroll">
              {eventFamilies.length === 0 ? (
                <div className="ae-empty-state"><p>No bookings found.</p></div>
              ) : eventFamilies.map(({ eventId, evt, families }) => {
                const persons = families.reduce((t, f) => t + f.persons, 0);
                return (
                  <div className="ae-fam-event" key={eventId}>
                    <div className="ae-fam-event-head">
                      <div>
                        <h4 className="ae-fam-event-title">{evt?.title || eventId}</h4>
                        <span className="ae-fam-event-sub">
                          {evt ? `${formatDate(evt.date)}${evt.time ? ` · ${fmtTime(evt.time)}` : ""}` : "Event removed"}
                        </span>
                      </div>
                      <div className="ae-fam-chips">
                        <span className="ae-fam-chip">{families.length} famil{families.length !== 1 ? "ies" : "y"}</span>
                        <span className="ae-fam-chip">{persons} person{persons !== 1 ? "s" : ""}</span>
                        {evt?.maxCapacity > 0 && <span className="ae-fam-chip">Capacity {evt.maxCapacity}</span>}
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="ae-fam-table">
                        <thead>
                          <tr>
                            <th>Family</th><th>Head / contact</th><th className="ae-fam-num">Bookings</th><th className="ae-fam-num">Persons</th>
                            <th>Gender (M · F · TG)</th><th>Kids · Elderly · Phys. challenged</th><th>Amount</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {families.map((f) => {
                            const rowKey = `${eventId}|${f.key}`;
                            const open = openFamilies.has(rowKey);
                            return (
                              <React.Fragment key={rowKey}>
                                <tr className={`ae-fam-row${open ? " ae-fam-open" : ""}`} onClick={() => toggleFamily(rowKey)}>
                                  <td className="ae-fam-no"><span className="ae-fam-caret">▸</span> Family {f.no}</td>
                                  <td>
                                    <div className="ae-fam-head-name">
                                      {f.head}
                                      <span className={`ae-fam-tag${f.isAccount ? "" : " guest"}`}>{f.isAccount ? "Account" : "Guest"}</span>
                                    </div>
                                    <div className="ae-fam-sub">{[f.phone, f.email].filter(Boolean).join(" · ") || "—"}</div>
                                  </td>
                                  <td className="ae-fam-num">{f.activeCount}</td>
                                  <td className="ae-fam-num"><strong>{f.persons}</strong></td>
                                  <td>{genderSummary(f)}</td>
                                  <td>{[f.kids, f.seniors, f.physicallyChallenged].join(" · ")}</td>
                                  <td>{f.amount ? `₹${f.amount.toLocaleString("en-IN")}` : "—"}</td>
                                  <td><span className={`ae-status-chip ae-status-${f.status}`}>{f.status}</span></td>
                                </tr>
                                {open && (
                                  <tr className="ae-fam-detail">
                                    <td colSpan={8}>
                                      <table className="ae-fam-inner">
                                        <thead>
                                          <tr><th>Booking</th><th>Booked on</th><th>Persons</th><th>Gender</th><th>Kids · Elderly · Phys. challenged</th><th>Status</th><th></th></tr>
                                        </thead>
                                        <tbody>
                                          {f.bookings.map((b) => {
                                            const a = normalizeAttendees(b);
                                            return (
                                              <tr key={b.id} className={b.status === "cancelled" ? "ae-fam-cancelled" : ""}>
                                                <td className="ae-mono">{String(b.id).slice(-8)}</td>
                                                <td>{formatDate(b.bookedAt || b.date)}</td>
                                                <td>{b.guests}</td>
                                                <td>{genderSummary(a)}</td>
                                                <td>{[a.kids, a.seniors, a.physicallyChallenged].join(" · ")}</td>
                                                <td className="keep">{b.status}</td>
                                                <td className="keep">
                                                  <Button3D variant="cancel" iconOnly onClick={(e) => { e.stopPropagation(); setViewBooking(b); bookingDetailModal.open(); }}>View</Button3D>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {bookView === "bookings" && (
          <div className="table-wrapper" ref={bookingsContainerRef}>
            {filteredBookings.length === 0 ? (
              <div className="ae-empty-state"><p>No bookings found.</p></div>
            ) : (
              <table >
                <thead>
                  <tr>
                    <th>#</th>
                    <th onClick={() => toggleBookSort("name")} className={bookSortKey === "name" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Name</span>
                        <BookSortIcon col="name" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("eventId")} className={bookSortKey === "eventId" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Event</span>
                        <BookSortIcon col="eventId" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("bookedAt")} className={bookSortKey === "bookedAt" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Date</span>
                        <BookSortIcon col="bookedAt" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("guests")} className={bookSortKey === "guests" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Guests</span>
                        <BookSortIcon col="guests" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("totalAmount")} className={bookSortKey === "totalAmount" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Amount</span>
                        <BookSortIcon col="totalAmount" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("status")} className={bookSortKey === "status" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Status</span>
                        <BookSortIcon col="status" />
                      </span>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.slice(0, bookingsDisplayLimit).map((b, i) => {
                    const evt = events.find((e) => e.id === b.eventId);
                    return (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td>
                          <div className="ae-booking-name">{b.name}</div>
                          <div className="ae-booking-email">{b.email}</div>
                        </td>
                        <td>{evt?.title || b.eventId}</td>
                        <td>{formatDate(b.bookedAt || b.date)}</td>
                        <td>
                          <strong>{b.guests}</strong>
                          <div className="ae-booking-email">{genderSummary(normalizeAttendees(b))}</div>
                        </td>
                        <td>{b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—"}</td>
                        <td>
                          <div className="evt-res-inline-status">
                            {["pending", "confirmed", "cancelled"].map(s => (
                              <button key={s} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={s}
                                className={`evt-res-istatus-btn evt-res-istatus-${s}${b.status === s ? " active" : ""}`}
                                onClick={() => handleBookingStatus(b.id, s)}>
                                {s === "pending" ? "P" : s === "confirmed" ? "C" : "X"}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="ae-booking-actions">
                            <Button3D variant="cancel" iconOnly onClick={() => { setViewBooking(b); bookingDetailModal.open(); }}>View</Button3D>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <InfiniteScrollLoader
                    sentinelRef={bookingsSentinelRef}
                    hasMore={bookingsHasMore}
                    colSpan={8}
                  />
                </tbody>
              </table>
            )}
          </div>
          )}
          {bookView === "bookings" && <InfiniteScrollOverlay isLoading={bookingsIsLoadingMore} />}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formModal.shouldRender && (
        <div className={`event-modal-overlay ${formModal.overlayClass}`}>
          <div className={`event-modal ae-event-modal ${formModal.modalClass}`}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "flex-start" }}>
                <h3>{isEditMode ? "Edit Event" : "Create New Event"}</h3>
                <div className="ecard">
                  {["Details", "Venue & Capacity", "Content", "Dishes & Preview"].map((s, i) => (
                    <button key={i} className={`ebutton ${editFormStep === i + 1 ? "active" : ""} ${editFormStep > i + 1 ? "done" : ""}`} onClick={() => {
                      if (i + 1 > editFormStep) {
                        for (let s = editFormStep; s < i + 1; s++) {
                          if (!validateEvtStep(s)) return;
                        }
                      }
                      setEditFormStep(i + 1);
                    }}>
                      <span className="eevt-step-num">{editFormStep > i + 1 ? "✓" : i + 1}</span>
                      <span className="eevt-step-label">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => { resetForm(); setFormErrors({}); }} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>

            <div className={`event-modal-body ae-event-form-body${editFormStep === 4 ? " ae-event-form-body--split" : ""}`}>

              {/* STEP 1 — Details */}
              {editFormStep === 1 && (
                <>
                  <div className="admin-form-group">
                    <div className="mat">
                      <input className={`mat-input${formErrors.title ? " mat-error" : ""}`} type="text" value={formData.title} onChange={(e) => { setFormData((p) => ({ ...p, title: allowTextInput(p.title, e.target.value, 100, 5) })); setFormErrors(p => ({ ...p, title: false })); }} placeholder=" " />
                      <label className={`mat-label${formErrors.title ? " mat-label-error" : ""}`}>Event Title <span className="rf-req">*</span></label>
                      <span className={`mat-bar${formErrors.title ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label>Event Type</label>
                      <CustomDropdown
                        value={formData.eventType}
                        onChange={v => setFormData((p) => ({ ...p, eventType: v }))}
                        options={[
                          ...EVENT_TYPES.map(t => ({ value: t.id, label: t.label })),
                          // an older event keeps its old type visible until the admin changes it
                          ...(EVENT_TYPES.some(t => t.id === formData.eventType) ? [] : [{ value: formData.eventType, label: eventTypeLabel(formData.eventType) }]),
                        ]}
                      />
                    </div>
                    <div className="admin-form-group">
                      <label>Status</label>
                      <CustomDropdown
                        value={formData.status}
                        onChange={v => setFormData((p) => ({ ...p, status: v }))}
                        options={[
                          { value: "upcoming", label: "Upcoming" },
                          { value: "ongoing", label: "Ongoing" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label className={formErrors.date ? "mat-label-error" : ""}>Date <span className="rf-req">*</span></label>
                      <CustomDatePicker value={formData.date} onChange={(v) => { setFormData((p) => ({ ...p, date: v })); setFormErrors(p => ({ ...p, date: false })); }} hasError={!!formErrors.date} />
                    </div>
                    <div className="admin-form-group">
                      <label>Time</label>
                      <CustomTimePicker value={formData.time} onChange={(v) => setFormData((p) => ({ ...p, time: v }))} />
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label>Last Date to Enroll <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(defaults to 2 days before event)</span></label>
                      <CustomDatePicker value={formData.bookingCloseDate || ""} max={formData.date || undefined} onChange={(v) => setFormData((p) => ({ ...p, bookingCloseDate: v }))} label="Select close date" />
                    </div>
                    <div className="admin-form-group">
                      <label>Last Date to Apply <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(registration deadline)</span></label>
                      <CustomDatePicker value={formData.lastApplyDate || ""} max={formData.date || undefined} onChange={(v) => setFormData((p) => ({ ...p, lastApplyDate: v }))} label="Select deadline" />
                    </div>
                  </div>

                  <div className="admin-form-group ae-publish-toggle">
                    <label className="ae-toggle-label">
                      <span>Publish Event (visible to users)</span>
                      <div className={`ae-toggle ${formData.isPublished ? "on" : "off"}`} onClick={() => setFormData((p) => ({ ...p, isPublished: !p.isPublished }))}>
                        <div className="ae-toggle-knob" />
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* STEP 2 — Venue & Capacity */}
              {editFormStep === 2 && (
                <>
                  <div className="admin-form-group">
                    <label>Venue / Location</label>
                    <div className="ae-venue-radio-row">
                      <label className={`ae-venue-radio ${formData.venueMode === "restaurant" ? "active" : ""}`}>
                        <input type="radio" name="venueMode" value="restaurant" checked={formData.venueMode === "restaurant"} onChange={() => setFormData(p => ({ ...p, venueMode: "restaurant", venue: restaurantVenueLine() }))} />
                        Restaurant
                      </label>
                      <label className={`ae-venue-radio ${formData.venueMode === "custom" ? "active" : ""}`}>
                        <input type="radio" name="venueMode" value="custom" checked={formData.venueMode === "custom"} onChange={() => setFormData(p => ({ ...p, venueMode: "custom", venue: "" }))} />
                        Custom
                      </label>
                    </div>
                    <textarea className={`ae-venue-textarea${formErrors.venue ? " mat-error" : ""}`} rows={3} value={formData.venue} disabled={formData.venueMode === "restaurant"} onChange={(e) => { setFormData(p => ({ ...p, venue: allowTextInput(p.venue, e.target.value, 500, 100000) })); setFormErrors(p => ({ ...p, venue: false })); }} placeholder="Enter full venue address…" />
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <div className="mat">
                        <input className={`mat-input${formErrors.maxCapacity ? " mat-error" : ""}`} type="number" min="0" value={formData.maxCapacity} onChange={(e) => { setFormData((p) => ({ ...p, maxCapacity: e.target.value })); setFormErrors(p => ({ ...p, maxCapacity: false })); }} placeholder=" " />
                        <label className={`mat-label${formErrors.maxCapacity ? " mat-label-error" : ""}`}>Max Capacity <span className="rf-req">*</span></label>
                        <span className={`mat-bar${formErrors.maxCapacity ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="admin-form-group">
                      <div className="mat">
                        <input className="mat-input" type="number" min="0" value={formData.price} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))} placeholder=" " />
                        <label className="mat-label">Price per Person (₹) — leave 0 for free entry</label>
                        <span className="mat-bar" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3 — Content */}
              {editFormStep === 3 && (
                <>
                  <div className="admin-form-group">
                    <div className="mat-area">
                      <textarea className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`} value={formData.description} rows={3} onChange={(e) => { setFormData((p) => ({ ...p, description: allowTextInput(p.description, e.target.value, 500, 100000) })); setFormErrors(p => ({ ...p, description: false })); }} placeholder=" " style={{ height: "auto", paddingTop: 4 }} />
                      <label className={`mat-area-label${formErrors.description ? " mat-label-error" : ""}`}>Description <span className="rf-req">*</span></label>
                      <span className={`mat-area-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Images (multiple)</label>
                    <ImageUploadBlock images={formData.images} onUpload={handleImagesUpload} onRemove={removeImage} inputRef={fileInputRef} />
                  </div>

                  <div className="admin-form-group">
                    <label>Tags</label>
                    <div className="ae-tag-input-row">
                      <div className="mat" style={{ flex: 1 }}>
                        <input className="mat-input" type="text" value={tagInput} onChange={(e) => setTagInput(allowTextInput(tagInput, e.target.value, 100, 5))} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); } }} />
                        <label className="mat-label">Add a tag…</label>
                        <span className="mat-bar" />
                      </div>
                      <button type="button" onClick={() => { if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); }}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
                    </div>
                    <div className="ae-tag-chips">
                      {(formData.tags || []).map((t, i) => (
                        <span key={i} className="ae-chip">{t}<button type="button" onClick={() => setFormData((p) => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}>×</button></span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Highlights</label>
                    <div className="ae-tag-input-row">
                      <div className="mat" style={{ flex: 1 }}>
                        <input className="mat-input" type="text" value={highlightInput} onChange={(e) => setHighlightInput(allowTextInput(highlightInput, e.target.value, 100, 5))} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); } }} />
                        <label className="mat-label">e.g. Live band, Open seating, Kids welcome…</label>
                        <span className="mat-bar" />
                      </div>
                      <button type="button" onClick={() => { if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); }}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
                    </div>
                    <div className="ae-tag-chips">
                      {(formData.highlights || []).map((h, i) => (
                        <span key={i} className="ae-chip ae-chip-green">{h}<button type="button" onClick={() => setFormData((p) => ({ ...p, highlights: p.highlights.filter((_, j) => j !== i) }))}>×</button></span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 4 — Dishes (left) & Preview (right), each side scrolls on its own */}
              {editFormStep === 4 && (
                <>
                  <div className="ae-ev-split-left">
                    <div className="admin-form-group">
                      <label>Menu Dishes for this Event <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(optional — add only if food is served)</span></label>
                      <DishSelector selectedDishes={formData.dishes} onToggle={toggleDish} activeCat={formData.selectedCategory || ""} onCatChange={(id) => setFormData(p => ({ ...p, selectedCategory: id }))} hideSelectedTable dishQty={formData.dishQty || {}} guests={Number(formData.maxCapacity) || 1} />
                    </div>
                  </div>

                  <div className="ae-ev-split-right">
                    <div className="ae-spec-summary">
                      <div className="evt-res-form-section-label">Preview</div>
                      <div className="ae-summary-grid">
                        <div className="ae-summary-row"><span className="ae-summary-key">Title</span><span className="ae-summary-val">{formData.title || "—"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Type</span><span className="ae-summary-val">{eventTypeLabel(formData.eventType)}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Status</span><span className="ae-summary-val">{formData.status}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Date</span><span className="ae-summary-val">{formData.date ? formatDate(formData.date) : "—"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Time</span><span className="ae-summary-val">{formData.time ? fmtTime(formData.time) : "—"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Venue</span><span className="ae-summary-val">{formData.venue || "—"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Capacity</span><span className="ae-summary-val">{formData.maxCapacity || "—"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Price</span><span className="ae-summary-val">{formData.price ? `₹${Number(formData.price).toLocaleString("en-IN")} / person` : "Free"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Published</span><span className="ae-summary-val">{formData.isPublished ? "Live" : "Draft"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Images</span><span className="ae-summary-val">{formData.images?.length || 0} added</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Tags</span><span className="ae-summary-val">{formData.tags?.length ? formData.tags.join(", ") : "—"}</span></div>
                        <div className="ae-summary-row"><span className="ae-summary-key">Highlights</span><span className="ae-summary-val">{formData.highlights?.length ? formData.highlights.join(", ") : "—"}</span></div>
                      </div>
                    </div>

                    <div className="ae-ev-selected">
                      <div className="ae-dishes-right-header">
                        Selected Dishes
                        {formData.dishes?.length > 0 && <span style={{ fontSize: 11, fontWeight: 500, color: "#888", marginLeft: 6 }}>({formData.dishes.length})</span>}
                      </div>
                      {!formData.dishes?.length ? (
                        <div className="ae-dishes-empty-right">No dishes selected.<br />Pick dishes from the left if food is served.</div>
                      ) : (
                        <div className="ae-ev-selected-list">
                          {formData.dishes.map((id) => {
                            const d = allDishes.find((x) => x.id === id);
                            if (!d) return null;
                            return (
                              <div key={id} className="ae-dishes-right-item">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: "#111", lineHeight: 1.3 }}>{d.name}</div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{d.subCat || d.cat || "—"}</div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#2563eb", flexShrink: 0 }}>₹{Number(d.basePrice || 0).toLocaleString("en-IN")}</div>
                                <button type="button" className="ae-sdt-remove" onClick={() => toggleDish(id)} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Remove">×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

            </div>

            <div className="event-modal-footer">
              <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
              {editFormStep > 1 && (
                <button type="button" className="modal-prev-btn" onClick={() => setEditFormStep(s => s - 1)}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">← Back</span>
                </button>
              )}
              {editFormStep < 4 ? (
                <button type="button" className="modal-next-btn" onClick={() => {
                  if (validateEvtStep(editFormStep)) setEditFormStep(s => s + 1);
                }}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">Next →</span>
                </button>
              ) : (
                <Button3D onClick={handleSave}>{isEditMode ? "Save Changes" : "Create Event"}</Button3D>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOOKING DETAIL MODAL */}
      {bookingDetailModal.shouldRender && (
        <div className={`event-modal-overlay ${bookingDetailModal.overlayClass}`}>
          <div className={`event-modal ae-booking-detail-modal ${bookingDetailModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Booking Details</h3>
              <Button3D variant="cancel" iconOnly onClick={() => bookingDetailModal.close(() => setViewBooking(null))} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="event-modal-body ae-booking-detail-body">
              {(() => {
                const b = viewBooking;
                const evt = events.find((e) => e.id === b.eventId);
                return (
                  <>
                    <div className="ae-detail-section">
                      <h4>Event</h4>
                      <p className="ae-detail-event-title">{evt?.title || b.eventId}</p>
                      <p>{formatDate(evt?.date)} {evt?.time && `· ${fmtTime(evt.time)}`}</p>
                    </div>
                    <div className="ae-detail-section">
                      <h4>Guest Information</h4>
                      <table className="data-table">
                        <tbody>
                          <tr><td>Name</td><td>{b.name}</td></tr>
                          <tr><td>Email</td><td>{b.email}</td></tr>
                          <tr><td>Phone</td><td>{b.phone}</td></tr>
                          <tr><td>Total persons</td><td><span className="ae-guest-count-badge">{b.guests}</span></td></tr>
                          {b.specialRequests && <tr><td>Special Requests</td><td>{b.specialRequests}</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <div className="ae-detail-section">
                      <h4>Persons Breakdown</h4>
                      {(() => {
                        const a = normalizeAttendees(b);
                        return (
                          <table className="data-table ae-detail-breakdown">
                            <tbody>
                              <tr><td>Male</td><td>{a.male}</td></tr>
                              <tr><td>Female</td><td>{a.female}</td></tr>
                              <tr><td>Third gender</td><td>{a.third}</td></tr>
                              {a.unspecified > 0 && <tr><td>Not specified</td><td>{a.unspecified} <span className="ae-add-guest-hint">(booked before the breakdown was collected)</span></td></tr>}
                              <tr><td>Kids (under 12)</td><td>{a.kids}</td></tr>
                              <tr><td>Elderly (60+)</td><td>{a.seniors}</td></tr>
                              <tr><td>Physically challenged</td><td>{a.physicallyChallenged}</td></tr>
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>

                    {b.status !== "cancelled" && (
                      <div className="ae-detail-section ae-add-guest-section">
                        <h4>Add More Persons</h4>
                        <p className="ae-add-guest-hint">
                          Current: <strong>{b.guests}</strong> person{b.guests !== 1 ? "s" : ""}.
                          {evt?.maxCapacity > 0 && (<> Seats left: <strong>{seatsLeftFor(evt)}</strong> of {evt.maxCapacity}.</>)}
                        </p>
                        <AttendeeFields
                          title="Persons to add"
                          value={addGuestAtt}
                          maxTotal={evt ? seatsLeftFor(evt) : null}
                          onChange={setAddGuestAtt}
                        />
                        <div className="ae-add-guest-row" style={{ marginTop: 10 }}>
                          <button className="modal-confirm-btn" disabled={addGuestSaving || attendeeTotal(addGuestAtt) < 1} onClick={() => handleAddGuests(b.id, addGuestAtt)}>
                            <span className="shadow"></span><span className="edge"></span>
                            <span className="front">
                              {addGuestSaving ? "Saving…" : `Add ${attendeeTotal(addGuestAtt)} Person${attendeeTotal(addGuestAtt) !== 1 ? "s" : ""}`}
                            </span>
                          </button>
                        </div>
                        {evt?.price > 0 && (
                          <p className="ae-add-guest-cost">
                            Additional charge: ₹{(attendeeTotal(addGuestAtt) * Number(evt.price)).toLocaleString("en-IN")}
                            &nbsp;· New total: ₹{((Number(b.guests) + attendeeTotal(addGuestAtt)) * Number(evt.price)).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="ae-detail-section">
                      <h4>Booking Info</h4>
                      <table className="data-table">
                        <tbody>
                          <tr><td>Booking ID</td><td className="ae-mono">{b.id}</td></tr>
                          <tr><td>Booked On</td><td>{formatDate(b.bookedAt)}</td></tr>
                          <tr><td>Amount</td><td>{b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—"}</td></tr>
                          <tr><td>Status</td><td><span className={`ae-status-chip ae-status-${b.status}`}>{b.status}</span></td></tr>
                          {b.status === "cancelled" && b.cancelReason && (
                            <tr><td>Cancellation Reason</td><td>{b.cancelReason}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="event-modal-footer">

              {viewBooking.status === "pending" && (
                <button className="modal-confirm-btn" onClick={() => handleBookingStatus(viewBooking.id, "confirmed")}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">Confirm Booking</span>
                </button>
              )}
              {viewBooking.status !== "cancelled" && (
                <Button3D variant="danger" onClick={() => handleBookingStatus(viewBooking.id, "cancelled")}>Cancel Booking</Button3D>
              )}
              <Button3D variant="cancel" onClick={() => { bookingDetailModal.close(() => setViewBooking(null)); setAddGuestAtt({ male: 0, female: 0, third: 0, kids: 0, seniors: 0, physicallyChallenged: 0 }); }}>Close</Button3D>

            </div>
          </div>
        </div>
      )}

      {/* ADD BOOKING MODAL */}
      {addBookingModal.shouldRender && (
        <div className={`event-modal-overlay ${addBookingModal.overlayClass}`}>
          <div className={`event-modal ae-add-booking-modal ${addBookingModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Add Booking</h3>
              <Button3D variant="cancel" iconOnly onClick={closeAddBooking} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="event-modal-body">
              <div className="admin-form-group">
                <label className={bookingErrors.eventId ? "mat-label-error" : ""}>Event <span className="rf-req">*</span></label>
                <CustomDropdown
                  value={bookingForm.eventId}
                  onChange={(v) => { setBookingForm((p) => ({ ...p, eventId: v })); setBookingErrors((p) => ({ ...p, eventId: undefined })); }}
                  placeholder="Select an event"
                  options={bookableEvents.map((e) => ({ value: e.id, label: `${e.title} · ${formatDate(e.date)}` }))}
                />
                {bookingEvent && (
                  <p className="ae-add-guest-hint">
                    {Number(bookingEvent.price) > 0 ? `₹${Number(bookingEvent.price).toLocaleString("en-IN")} per person` : "Free entry"}
                    {bookingSeatsLeft !== null && <> · <strong>{bookingSeatsLeft}</strong> seat{bookingSeatsLeft !== 1 ? "s" : ""} left</>}
                  </p>
                )}
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input className={`mat-input${bookingErrors.name ? " mat-error" : ""}`} type="text" value={bookingForm.name} placeholder=" "
                    onChange={(e) => { setBookingForm((p) => ({ ...p, name: toTitleCase(allowTextInput(p.name, e.target.value, 100, 5)) })); setBookingErrors((p) => ({ ...p, name: undefined })); }} />
                  <label className={`mat-label${bookingErrors.name ? " mat-label-error" : ""}`}>Name (family head) <span className="rf-req">*</span></label>
                  <span className={`mat-bar${bookingErrors.name ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="ae-form-row">
                <div className="admin-form-group">
                  <div className="mat">
                    <input className={`mat-input${bookingErrors.phone ? " mat-error" : ""}`} type="tel" maxLength={10} value={bookingForm.phone} placeholder=" "
                      onChange={(e) => { setBookingForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })); setBookingErrors((p) => ({ ...p, phone: undefined })); }} />
                    <label className={`mat-label${bookingErrors.phone ? " mat-label-error" : ""}`}>Phone <span className="rf-req">*</span></label>
                    <span className={`mat-bar${bookingErrors.phone ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <div className="mat">
                    <input className={`mat-input${bookingErrors.email ? " mat-error" : ""}`} type="email" value={bookingForm.email} placeholder=" "
                      onChange={(e) => { setBookingForm((p) => ({ ...p, email: e.target.value })); setBookingErrors((p) => ({ ...p, email: undefined })); }} />
                    <label className={`mat-label${bookingErrors.email ? " mat-label-error" : ""}`}>Email (optional)</label>
                    <span className={`mat-bar${bookingErrors.email ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
              </div>
              {matchingFamily && (
                <p className="ae-add-booking-note">Same phone number as Family {matchingFamily.no} ({matchingFamily.head}) — this booking will be added to that family.</p>
              )}

              <div className="admin-form-group" style={{ marginTop: 12 }}>
                <AttendeeFields
                  value={bookingForm.attendees}
                  maxTotal={bookingSeatsLeft}
                  error={bookingErrors.attendees}
                  onChange={(attendees) => { setBookingForm((p) => ({ ...p, attendees })); setBookingErrors((p) => ({ ...p, attendees: undefined })); }}
                />
              </div>

              <div className="ae-form-row">
                <div className="admin-form-group">
                  <label>Status</label>
                  <CustomDropdown
                    value={bookingForm.status}
                    onChange={(v) => setBookingForm((p) => ({ ...p, status: v }))}
                    options={[{ value: "confirmed", label: "Confirmed" }, { value: "pending", label: "Pending" }]}
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat-area">
                  <textarea className="mat-input mat-textarea" rows={2} value={bookingForm.specialRequests} placeholder=" " style={{ height: "auto", paddingTop: 4 }}
                    onChange={(e) => setBookingForm((p) => ({ ...p, specialRequests: allowTextInput(p.specialRequests, e.target.value, 300, 100000) }))} />
                  <label className="mat-area-label">Special requests (optional)</label>
                  <span className="mat-area-bar" />
                </div>
              </div>

              <div className="ae-add-booking-total">
                <span>{bookingTotal} person{bookingTotal !== 1 ? "s" : ""}</span>
                <span>{bookingAmount ? `₹${bookingAmount.toLocaleString("en-IN")}` : "Free"}</span>
              </div>
            </div>
            <div className="event-modal-footer">
              <Button3D variant="cancel" onClick={closeAddBooking}>Cancel</Button3D>
              <Button3D onClick={handleCreateBooking} disabled={bookingSaving}>{bookingSaving ? "Saving…" : "Add Booking"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmModal.shouldRender && (
        <div className={`event-modal-overlay ${deleteConfirmModal.overlayClass}`}>
          <div className={`event-modal ae-confirm-modal ${deleteConfirmModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Delete Event</h3>
              <Button3D variant="cancel" iconOnly onClick={() => deleteConfirmModal.close(() => setConfirmDeleteId(null))} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="event-modal-body">
              <p style={{ margin: "8px 0 20px", color: "#444", fontSize: 14, lineHeight: 1.6 }}>
                Are you sure you want to delete this event? All associated bookings will also be removed. This cannot be undone.
              </p>
            </div>
            <div className="event-modal-footer">
              <Button3D variant="cancel" onClick={() => deleteConfirmModal.close(() => setConfirmDeleteId(null))}>Cancel</Button3D>
              <Button3D variant="danger" onClick={confirmDelete}>Delete Event</Button3D>

            </div>
          </div>
        </div>
      )}

      <CancelReasonModal
        popup={cancelBookingPopup}
        title="Cancel Booking"
        itemLabel={cancelBookingPopup.data?.name}
        onConfirm={handleBookingCancelConfirm}
      />
    </div>
  );
};

export default Events;