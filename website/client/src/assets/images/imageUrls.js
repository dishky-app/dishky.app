// Centralized Unsplash image URLs for placeholder photography across the
// site. Using the direct images.unsplash.com CDN path (permanent, no API
// key required) rather than the deprecated source.unsplash.com redirect
// service. Swap these for licensed/owned photography before launch —
// see README "Continuing the build" for that note.
//
// Attribution: Unsplash License permits this use without per-image credit
// for most contexts, but a visible photographer credit is good practice
// if any of these ship to production. Photo IDs below are confirmed real,
// pulled from production restaurant/food-app usage.

function unsplash(id, { w = 1200, q = 80 } = {}) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;
}

export const images = {
  // Restaurant interiors / dining
  restaurantInterior1: unsplash("1414235077428-338989a2e8c0", { w: 1600 }),
  restaurantInterior2: unsplash("1517248135467-4c7edcad34c4", { w: 1600 }),
  restaurantTable: unsplash("1552566626-52f8b828add9", { w: 1400 }),

  // Kitchen / chefs
  kitchenAction: unsplash("1556910103-1c02745aae4d", { w: 1600 }),
  chefPlating: unsplash("1577219491135-ce391730fb2c", { w: 1400 }),

  // Food / dishes
  dishBiryani: unsplash("1701579231378-3726490a407b", { w: 900 }),
  dishCurry: unsplash("1631515243349-e0cb75fb8d3a", { w: 900 }),
  dishPasta: unsplash("1621996346565-e3dbc353d2e5", { w: 900 }),
  dishDessert: unsplash("1551024506-0bccd828d307", { w: 900 }),
  dishDrink: unsplash("1578314675249-a6910f80cc4e", { w: 700 }),

  // The four stages of service (Order -> Cook -> Serve -> Pay).
  // All are free-licence Unsplash photos. `serviceOrder` is the closest free
  // match to "taking an order" I could verify; swap its id for a closer shot
  // if you find one.
  serviceOrder: unsplash("1496811425508-6d7ebb7ff32c", { w: 1000 }),
  serviceCook: unsplash("1577219491135-ce391730fb2c", { w: 1000 }),
  serviceServe: unsplash("1511421616335-5a9846f1afcb", { w: 1000 }),
  servicePay: unsplash("1726064855857-46c37dc43c78", { w: 1000 }),

  // More photography for the module pages (swap freely; every <Photo> falls
  // back to a warm gradient if a URL ever fails to load).
  foodSpread: unsplash("1504674900247-0877df9cc836", { w: 1400 }),
  grill: unsplash("1555939594-58d7cb561ad1", { w: 1200 }),
  pizza: unsplash("1565299624946-b28f40a0ae38", { w: 1200 }),
  salad: unsplash("1540189549336-e6e99c3679fe", { w: 1200 }),
  steak: unsplash("1600891964092-4316c288032e", { w: 1200 }),
  dining: unsplash("1559339352-11d035aa65de", { w: 1600 }),
  friends: unsplash("1528605248644-14dd04022da1", { w: 1400 }),
  bar: unsplash("1466978913421-dad2ebd01d17", { w: 1400 }),

  // Café / bakery
  cafeInterior: unsplash("1495474472287-4d71bcdd2085", { w: 1400 }),
};

/**
 * Real photography is ON. Every scene key used by <Art>/<Photo> maps to a
 * photograph below; the original illustration stays underneath as a fallback
 * that shows only if a photo fails to load. Swap any URL for your own
 * licensed photography. Set USE_STOCK_PHOTOS = false to go back to the
 * illustrations.
 */
export const USE_STOCK_PHOTOS = true;

const I = images;
export const sceneImages = {
  order: I.serviceOrder, cook: I.chefPlating, serve: I.serviceServe, pay: I.servicePay,
  platform: I.restaurantInterior2, experience: I.dining, operations: I.kitchenAction,
  "p-lost": I.kitchenAction, "p-stock": I.foodSpread, "p-access": I.restaurantTable, "p-cash": I.servicePay,
  "p-double": I.restaurantTable, "p-branches": I.restaurantInterior1, "p-menu": I.dishBiryani,
  "p-food": I.dishCurry, "p-ingredients": I.salad, "p-bill": I.servicePay,
  "b-guests": I.friends, "b-flow": I.chefPlating, "post-spotlight": I.dishDessert, "post-collab": I.bar,
  "post-offer": I.pizza, "post-launch": I.dishBiryani, chaos: I.kitchenAction, calm: I.restaurantInterior2,
  cta: I.dining, night: I.friends, "city-chennai": I.restaurantInterior1, "city-madurai": I.restaurantInterior2,
  "city-coimbatore": I.cafeInterior,
  "food-curry": I.dishCurry, "food-biryani": I.dishBiryani, "food-pasta": I.dishPasta, "food-dessert": I.dishDessert,
  "food-salad": I.salad, "food-pizza": I.pizza, "food-steak": I.steak, "food-drink": I.dishDrink,
  kitchen: I.kitchenAction, orders: I.serviceOrder, payments: I.servicePay, analytics: I.restaurantInterior2,
  staff: I.chefPlating, inventory: I.foodSpread, loyalty: I.friends, promotions: I.bar, events: I.friends,
  bookings: I.restaurantTable, service: I.serviceServe, qr: I.serviceOrder, roles: I.restaurantTable,
  branches: I.restaurantInterior1, backoffice: I.cafeInterior, guests: I.friends, menu: I.foodSpread,
};
