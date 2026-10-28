import React from "react";
import DriftWall from "../ReactBits/DriftWall.js";
import LazyGL from "../ReactBits/LazyGL.js";
import usePhotos from "../ReactBits/usePhotos.js";
import { images } from "../../assets/images/imageUrls.js";

const list = [
  [images.serviceOrder, "order"], [images.chefPlating, "cook"], [images.serviceServe, "serve"], [images.servicePay, "pay"],
  [images.restaurantInterior1, "platform"], [images.dining, "experience"], [images.kitchenAction, "operations"],
  [images.friends, "b-guests"], [images.restaurantTable, "p-double"], [images.restaurantInterior2, "night"],
  [images.foodSpread, "p-stock"], [images.bar, "post-collab"], [images.dishBiryani, "food-biryani"],
  [images.pizza, "food-pizza"], [images.cafeInterior, "city-coimbatore"],
];

/** A slowly drifting wall of restaurant and service photos behind the Service section. */
export default function DriftBackground() {
  return (
    <LazyGL className="pointer-events-none absolute inset-0" margin="30% 0px">
      <DriftScene />
    </LazyGL>
  );
}

function DriftScene() {
  const urls = usePhotos(list.map(([photo, art]) => ({ photo, art })));
  if (!urls) return null;
  const states = [["Dining", "#ff6a4d"], ["Free", "#f55239"], ["Reserved", "#f99a8b"], ["Bill due", "#f6644d"]];
  const tables = urls.slice(0, 12).concat(urls).slice(0, 12).map((image, i) => ({
    image, title: `Table ${i + 1}`, label: `T${i + 1}`, status: states[i % 4][0], color: states[i % 4][1],
  }));
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <DriftWall
        items={tables}
        columns={6}
        tileWidth={260}
        tileHeight={170}
        gap={18}
        radius={0}
        tilt={14}
        turn={-12}
        perspective={1300}
        depth={160}
        speed={34}
        dim={0.6}
        fade={0.35}
        parallax={0}
        overlayColor="#0a0a0a"
      />
    </div>
  );
}
