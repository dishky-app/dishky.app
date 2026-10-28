import React, { useEffect, useState } from "react";
import CircularGallery from "../ReactBits/CircularGallery.js";
import LazyGL from "../ReactBits/LazyGL.js";
import usePhotos from "../ReactBits/usePhotos.js";
import { guestProblems } from "../../data/problems.js";
import { images } from "../../assets/images/imageUrls.js";

const extra = [
  { fix: "Offers & loyalty", img: images.friends, art: "b-guests" },
  { fix: "Reorder favourites", img: images.pizza, art: "food-pizza" },
];
const cards = guestProblems.concat(extra);

/** The guest-side fixes on a strongly curved gallery that glides as the page scrolls. */
export default function GuestGallery() {
  return (
    <LazyGL className="dk-bleed relative h-[20rem] overflow-hidden bg-white md:h-[24rem]">
      <GalleryScene />
    </LazyGL>
  );
}

function GalleryScene() {
  // A gentler curve on phones, where the same bend looks far more extreme.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const urls = usePhotos(cards.map((p) => ({ photo: p.img, art: p.art })));
  return (
    <>
      {urls && (
        <CircularGallery
          items={cards.map((p, i) => ({ image: urls[i], text: p.fix }))}
          bend={narrow ? 2.5 : 7}
          textColor="#0a0a0a"
          borderRadius={0.12}
          font="bold 24px Sora"
          scrollSpeed={2}
          scrollEase={0.05}
        />
      )}
    </>
  );
}
