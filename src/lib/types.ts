// Row shapes for the queries the app runs. Kept by hand until the project
// has a hosted database to generate types from (`supabase gen types`).

export type Area = {
  id: number;
  parent_id: number | null;
  type: "state" | "city" | "area";
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  sort_order: number;
};

export type Category = {
  id: number;
  slug: string;
  slug_ms: string;
  name_en: string;
  name_ms: string;
  name_zh: string | null;
  schema_type: string;
  sort_order: number;
};

export type Attribute = {
  id: number;
  slug: string;
  group_name: "audience" | "language" | "amenity" | "service_mode";
  name_en: string;
  name_ms: string;
};

export type Service = {
  id: number;
  name: string;
  price_from: number | null;
  price_to: number | null;
  duration_min: number | null;
};

export type OpeningHours = {
  weekday: number;
  opens: string;
  closes: string;
};

export type Closure = {
  date_from: string;
  date_to: string;
  note: string | null;
};

export type Photo = {
  id: number;
  storage_path: string;
  alt: string | null;
};

export type ListingStatus = "active" | "closed" | "hidden" | "archived";

export type ListingDetail = {
  id: string;
  slug: string;
  name: string;
  status: ListingStatus;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  description: string | null;
  price_level: number | null;
  gender: "men" | "women" | "unisex" | null;
  last_verified_at: string | null;
  updated_at: string;
  is_claimed: boolean;
  area: Area | null;
  // Ancestors from the top down, e.g. [Kuala Lumpur, Bangsar].
  area_path: Area[];
  categories: (Category & { is_primary: boolean })[];
  attributes: Attribute[];
  services: Service[];
  // True when `services` is the category's standard menu, not the shop's own.
  services_are_template: boolean;
  hours: OpeningHours[];
  closures: Closure[];
  photos: Photo[];
};

export type ListingCard = {
  id: string;
  slug: string;
  name: string;
  area_name: string | null;
  area_slug: string | null;
  primary_category: string | null;
  price_level: number | null;
  gender: "men" | "women" | "unisex" | null;
  is_claimed: boolean;
  open_now: boolean;
  cover_path: string | null;
  total_count: number;
};

export type SearchParams = {
  q?: string;
  category?: string;
  area?: string;
  attributes?: string[];
  gender?: "men" | "women";
  openNow?: boolean;
  page?: number;
};
