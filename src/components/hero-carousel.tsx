"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Slide = { image: string; alt: string };

export function HeroCarousel({
  slides,
  interval,
}: {
  slides: Slide[];
  interval: number;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % slides.length),
      interval * 1000,
    );
    return () => window.clearInterval(timer);
  }, [interval, paused, slides.length]);

  if (!slides.length) return null;
  const move = (step: number) =>
    setActive((index) => (index + step + slides.length) % slides.length);

  return (
    <>
      <div
        role="group"
        aria-label="Homepage image carousel"
        className="absolute inset-0 -z-20"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
      >
        {slides.map((slide, index) => (
          <Image
            key={`${slide.image}-${index}`}
            src={slide.image}
            alt={index === active ? slide.alt : ""}
            fill
            sizes="(min-width: 1152px) 1120px, calc(100vw - 32px)"
            className={`object-cover object-right transition-opacity duration-700 motion-reduce:transition-none ${index === active ? "opacity-100" : "opacity-0"}`}
            preload={index === 0}
            aria-hidden={index !== active}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div
          className="absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded-full bg-white/90 px-2 py-1 shadow sm:right-6 sm:bottom-6"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
          }}
        >
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm font-medium hover:bg-black/5"
            aria-label="Previous hero image"
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <span className="min-w-12 text-center text-xs" aria-live="polite">
            {active + 1} / {slides.length}
          </span>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm font-medium hover:bg-black/5"
            aria-label="Next hero image"
            onClick={() => move(1)}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
