import { siteUrl } from "@/lib/env";
import { photoUrl } from "@/lib/format";
import { SCHEMA_DAYS, hhmm } from "@/lib/hours";
import type { ListingDetail } from "@/lib/types";

type JsonLd = Record<string, unknown>;

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function itemListJsonLd(name: string, items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(item.path),
      name: item.name,
    })),
  };
}

export function listingJsonLd(listing: ListingDetail): JsonLd {
  const primary = listing.categories[0];
  const city = listing.area_path.find((a) => a.type === "city");
  const services = listing.services_are_template ? [] : listing.services;
  return {
    "@context": "https://schema.org",
    "@type": primary?.schema_type ?? "BeautySalon",
    "@id": absoluteUrl(`/shop/${listing.slug}#business`),
    name: listing.name,
    url: absoluteUrl(`/shop/${listing.slug}`),
    description: listing.description ?? undefined,
    telephone: listing.phone ? `+${listing.phone}` : undefined,
    image: listing.photos.map((p) => photoUrl(p.storage_path)),
    priceRange: listing.price_level ? "$".repeat(listing.price_level) : undefined,
    address: listing.address
      ? {
          "@type": "PostalAddress",
          streetAddress: listing.address,
          postalCode: listing.postcode ?? undefined,
          addressLocality: listing.area?.name,
          addressRegion: city?.name,
          addressCountry: "MY",
        }
      : undefined,
    geo:
      listing.lat !== null && listing.lng !== null
        ? { "@type": "GeoCoordinates", latitude: listing.lat, longitude: listing.lng }
        : undefined,
    openingHoursSpecification: listing.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_DAYS[h.weekday],
      opens: hhmm(h.opens),
      closes: hhmm(h.closes),
    })),
    sameAs: [listing.website, listing.instagram, listing.facebook].filter(Boolean),
    makesOffer: services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name },
      priceSpecification:
        s.price_from !== null
          ? {
              "@type": "PriceSpecification",
              priceCurrency: "MYR",
              minPrice: Number(s.price_from),
              maxPrice: s.price_to !== null ? Number(s.price_to) : undefined,
            }
          : undefined,
    })),
  };
}

// Escapes "<" so a description containing "</script>" can't break out.
export function jsonLdScript(data: JsonLd | JsonLd[]): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
