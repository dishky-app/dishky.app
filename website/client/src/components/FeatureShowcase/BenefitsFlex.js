import React from "react";
import FlexCarousel from "../ReactBits/FlexCarousel.js";
import LazyGL from "../ReactBits/LazyGL.js";
import usePhotos from "../ReactBits/usePhotos.js";
import { images } from "../../assets/images/imageUrls.js";

const list = [
  [images.restaurantInterior1, "platform", "Everything in one place"],
  [images.friends, "b-guests", "Happier guests"],
  [images.kitchenAction, "b-flow", "A kitchen that flows"],
  [images.serviceServe, "serve", "Organised service"],
  [images.dining, "p-branches", "Every branch, one view"],
  [images.chefPlating, "analytics", "Numbers that guide you"],
];

/** Benefits as a full-width row of photos that bends like liquid glass as you drag it. */
export default function BenefitsFlex() {
  return (
    <LazyGL className="dk-bleed relative h-[30rem] overflow-hidden bg-white text-ink md:h-[38rem]">
      <FlexScene />
    </LazyGL>
  );
}

function FlexScene() {
  const urls = usePhotos(list.map(([photo, art]) => ({ photo, art })));
  return (
    <>
      {urls && (
        <FlexCarousel
          items={list.map(([, , t], i) => ({ src: urls[i], alt: t, title: t }))}
          preset="liquid"
          intro="rise"
          fit="landscape"
          cardHeight={0.4}
          gap={0}
          radius={0}
          captions
        />
      )}
    </>
  );
}
