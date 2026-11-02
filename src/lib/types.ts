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
  // Usual days between visits, for "time for a touch-up".
  rebook_days?: number | null;
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
  // Standard menu items only: the Malay name, shown on /ms pages.
  name_ms?: string | null;
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
  kind: "shop" | "portfolio" | "team";
  caption: string | null;
  category_id: number | null;
};

export type StaffMember = {
  id: number;
  name: string;
  title: string | null;
  bio: string | null;
  photo_path: string | null;
  languages: string[];
};

export const OCCASIONS = ["raya", "cny", "deepavali", "christmas", "merdeka", "wedding", "other"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export type Promotion = {
  id: number;
  title: string;
  details: string | null;
  price_label: string | null;
  occasion: Occasion;
  starts_on: string;
  ends_on: string;
};

export const PACKAGE_KINDS = ["bridal", "event", "group", "other"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

export type ServicePackage = {
  id: number;
  kind: PackageKind;
  name: string;
  description: string | null;
  includes: string[];
  price_from: number | null;
  price_to: number | null;
};

export type BookingSettings = {
  instant_enabled: boolean;
  slot_minutes: number;
  capacity: number;
  min_notice_hours: number;
  max_days_ahead: number;
};

export type VoucherSettings = {
  enabled: boolean;
  amounts: number[];
  valid_months: number;
  terms: string | null;
};

export type LoyaltyProgram = {
  enabled: boolean;
  stamps_required: number;
  reward: string;
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
  // Shop photos first (the first is the profile photo), then team, then portfolio.
  photos: Photo[];
  video_path: string | null;
  staff: StaffMember[];
  // Running today or later, soonest ending first.
  promotions: Promotion[];
  packages: ServicePackage[];
  // Areas a home-service vendor travels to.
  service_areas: Area[];
  booking: BookingSettings | null;
  vouchers: VoucherSettings | null;
  loyalty: LoyaltyProgram | null;
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
  lat: number | null;
  lng: number | null;
  min_price: number | null;
  max_price: number | null;
  distance_km: number | null;
  is_featured: boolean;
  has_deal: boolean;
  rating_avg: number | null;
  rating_count: number;
  total_count: number;
};

export type SearchParams = {
  q?: string;
  category?: string;
  area?: string;
  attributes?: string[];
  gender?: "men" | "women";
  openNow?: boolean;
  openLate?: boolean;
  maxPrice?: number;
  near?: { lat: number; lng: number };
  radiusKm?: number;
  sort?: "distance" | "price";
  slugs?: string[];
  page?: number;
  pageSize?: number;
};
