import { z } from "zod";

const copy = z.object({
  title: z.string().trim().max(100).default(""),
  description: z.string().trim().max(320).default(""),
  heroTitle: z.string().trim().max(160).default(""),
  heroLead: z.string().trim().max(500).default(""),
});
export const heroSlideSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
  image: z.string().max(1000).default(""),
  alt: z.string().trim().max(200).default(""),
});
export const websiteSchema = z.object({
  name: z.string().trim().min(1).max(80).default("BeautyBook"),
  logo: z.string().max(1000).default(""),
  favicon: z.string().max(1000).default(""),
  socialImage: z.string().max(1000).default(""),
  heroImage: z.string().max(1000).default(""),
  heroAlt: z.string().trim().max(200).default(""),
  heroSlides: z.array(heroSlideSchema).max(10).default([]),
  heroInterval: z.coerce.number().int().min(3).max(20).default(6),
  businessImage: z.string().max(1000).default(""),
  businessAlt: z.string().trim().max(200).default(""),
  categoryImages: z.record(z.string(), z.string().max(1000)).default({}),
  indexing: z.boolean().default(true),
  googleVerification: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-zA-Z0-9_-]*$/)
    .default(""),
  en: copy.default({ title: "", description: "", heroTitle: "", heroLead: "" }),
  ms: copy.default({ title: "", description: "", heroTitle: "", heroLead: "" }),
  zh: copy.default({ title: "", description: "", heroTitle: "", heroLead: "" }),
});
export type WebsiteSettings = z.infer<typeof websiteSchema>;
export const DEFAULT_WEBSITE = websiteSchema.parse({});
