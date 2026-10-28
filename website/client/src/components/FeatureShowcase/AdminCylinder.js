import React, { useEffect, useState } from "react";
import CircularCarousel from "../ReactBits/CircularCarousel.js";
import LazyGL from "../ReactBits/LazyGL.js";
import usePhotos from "../ReactBits/usePhotos.js";
import { adminProblems } from "../../data/problems.js";
import { images } from "../../assets/images/imageUrls.js";

// Ten cards on the ring so five of them face the viewer at once.
const extra = [
  { pain: "Paper rosters", fix: "Attendance & salary", img: images.chefPlating, art: "staff" },
  { pain: "Menu changes take days", fix: "Edit the menu live", img: images.dishCurry, art: "menu" },
  { pain: "Guests never return", fix: "Loyalty that works", img: images.friends, art: "loyalty" },
  { pain: "Guessing at sales", fix: "Reports that guide you", img: images.restaurantInterior2, art: "analytics" },
];
const cards = adminProblems.concat(extra);

/** Ten owner problems on a circular carousel of real photos. Drag, swipe or use the arrow keys. */
export default function AdminCylinder() {
  return (
    <LazyGL className="dk-bleed relative h-[28rem] overflow-hidden bg-white text-ink md:h-[34rem]">
      <CylinderScene />
    </LazyGL>
  );
}

function CylinderScene() {
  // On phones the ring shrinks to fit, which put five cards in front. Six cards on the
  // ring keeps exactly three facing you; wider screens keep all ten.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const list = narrow ? cards.slice(0, 6) : cards;
  const urls = usePhotos(list.map((p) => ({ photo: p.img, art: p.art })));
  return (
    <>
      {urls && (
        <CircularCarousel
          items={list.map((p, i) => ({
            src: urls[i],
            alt: `${p.pain}: ${p.fix}`,
            title: p.fix,
            subtitle: `was: ${p.pain}`,
          }))}
          preset="cylinder"
          intro="rise"
          cardWidth={340}
          aspectRatio={1.4}
          gap={26}
          cornerRadius={24}
          captions
          autoplay="drift"
          speed={12}
          fadeColor="#ffffff"
          depthFade={0.5}
        />
      )}
    </>
  );
}
