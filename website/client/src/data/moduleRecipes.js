/**
 * One recipe per module page: which hero opens it, how its title animates,
 * and which animated blocks follow, in order. No two modules share a recipe,
 * so each page looks and moves differently.
 *
 * frames : linear, sidebar, tabs, bento, spine, chapters, magazine, split, carousel
 * skins  : brutal, editorial, swiss, blueprint, receipt, poster, soft, noir, hazard
 * heroes : poster, kinetic, orbit, terminal, fan, splitLight, centerGlow, photoStack
 * titles : wordRise, letters, typewriter, blur, slideMask
 * blocks : rail, flow, tickets, calendar, ledger, wheel, stack, chat, bars,
 *          compare, spotlight, timeline, rings, gallery, uses, steps, faq, extra
 */
export const recipes = {
  "guest-app": { frame: "linear", skin: "brutal", hero: "poster",     title: "letters",    blocks: ["stack", "rail", "rings", "chat", "compare", "faq"] },
  "menu": { frame: "sidebar", skin: "swiss", hero: "fan",        title: "wordRise",   blocks: ["spotlight", "flow", "bars", "gallery", "uses", "faq"] },
  "order-tracking": { frame: "tabs", skin: "receipt", hero: "terminal",   title: "typewriter", blocks: ["flow", "tickets", "rings", "compare", "steps", "faq"] },
  "offers": { frame: "bento", skin: "soft", hero: "kinetic",    title: "slideMask",  blocks: ["calendar", "spotlight", "compare", "chat", "rings", "faq"] },
  "loyalty": { frame: "spine", skin: "hazard", hero: "orbit",      title: "blur",       blocks: ["rings", "wheel", "timeline", "chat", "gallery", "faq"] },
  "guests": { frame: "chapters", skin: "editorial", hero: "splitLight", title: "letters",    blocks: ["spotlight", "timeline", "bars", "chat", "compare", "faq"] },
  "orders": { frame: "magazine", skin: "blueprint", hero: "terminal",   title: "wordRise",   blocks: ["tickets", "flow", "bars", "ledger", "compare", "faq"] },
  "kitchen": { frame: "split", skin: "poster", hero: "kinetic",    title: "typewriter", blocks: ["tickets", "rail", "rings", "timeline", "uses", "faq"] },
  "kitchen-management": { frame: "carousel", skin: "noir", hero: "photoStack", title: "slideMask",  blocks: ["timeline", "spotlight", "tickets", "compare", "steps", "faq"] },
  "service": { frame: "linear", skin: "blueprint", hero: "centerGlow", title: "blur",       blocks: ["wheel", "rail", "tickets", "rings", "uses", "faq"] },
  "service-management": { frame: "sidebar", skin: "poster", hero: "fan",        title: "letters",    blocks: ["wheel", "timeline", "spotlight", "rings", "uses", "faq"] },
  "inventory": { frame: "tabs", skin: "noir", hero: "poster",     title: "wordRise",   blocks: ["bars", "ledger", "rings", "flow", "compare", "faq"] },
  "payments": { frame: "bento", skin: "brutal", hero: "orbit",      title: "typewriter", blocks: ["ledger", "flow", "rings", "chat", "compare", "faq"] },
  "events": { frame: "spine", skin: "swiss", hero: "poster",     title: "slideMask",  blocks: ["calendar", "rail", "gallery", "chat", "steps", "faq"] },
  "reservations": { frame: "chapters", skin: "receipt", hero: "splitLight", title: "blur",       blocks: ["calendar", "spotlight", "flow", "rings", "compare", "faq"] },
  "celebrations": { frame: "magazine", skin: "soft", hero: "fan",        title: "blur",       blocks: ["rail", "gallery", "calendar", "chat", "steps", "faq"] },
  "catering": { frame: "split", skin: "hazard", hero: "kinetic",    title: "wordRise",   blocks: ["flow", "ledger", "tickets", "gallery", "compare", "faq"] },
  "prebookings": { frame: "carousel", skin: "editorial", hero: "centerGlow", title: "typewriter", blocks: ["timeline", "calendar", "flow", "rings", "uses", "faq"] },
  "staff": { frame: "linear", skin: "soft", hero: "photoStack", title: "letters",    blocks: ["wheel", "calendar", "chat", "rings", "compare", "faq"] },
  "attendance": { frame: "sidebar", skin: "hazard", hero: "terminal",   title: "slideMask",  blocks: ["rings", "calendar", "timeline", "bars", "uses", "faq"] },
  "salary": { frame: "tabs", skin: "editorial", hero: "orbit",      title: "letters",    blocks: ["ledger", "bars", "calendar", "compare", "steps", "faq"] },
  "careers": { frame: "bento", skin: "blueprint", hero: "splitLight", title: "wordRise",   blocks: ["rail", "timeline", "spotlight", "chat", "steps", "faq"] },
  "roles": { frame: "spine", skin: "poster", hero: "terminal",   title: "blur",       blocks: ["wheel", "spotlight", "flow", "compare", "rings", "faq"] },
  "branches": { frame: "chapters", skin: "noir", hero: "centerGlow", title: "slideMask",  blocks: ["bars", "flow", "wheel", "rings", "compare", "faq"] },
  "back-office": { frame: "magazine", skin: "brutal", hero: "kinetic",    title: "letters",    blocks: ["spotlight", "timeline", "ledger", "rail", "uses", "faq"] },
  "promotions": { frame: "split", skin: "swiss", hero: "poster",     title: "typewriter", blocks: ["rail", "wheel", "calendar", "bars", "gallery", "faq"] },
  "analytics": { frame: "carousel", skin: "receipt", hero: "photoStack", title: "wordRise",   blocks: ["bars", "rings", "timeline", "ledger", "compare", "faq"] },
};
export const fallbackRecipe = { frame: "linear", skin: "soft", hero: "centerGlow", title: "wordRise", blocks: ["spotlight", "flow", "rings", "compare", "uses", "faq"] };
