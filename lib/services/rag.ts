import "dotenv/config";

import { prisma } from "../db";
import { PRODUCT_COLOR_OPTIONS, PRODUCT_SIZE_OPTIONS } from "../product-options";

export interface RetrievedProduct {
  id: string;
  title: string;
  price: number;
  color: string | null;
  size: string | null;
  stock: number;
  image: string;
  isActive: boolean;
  categoryName: string | null;
  similarity: number;
  specifications: {
    color: string;
    size: string;
    qty: number;
    sku: string | null;
  }[];
  /** Color-tagged gallery; used to pick the right thumbnail, stripped before API if needed */
  galleryImages?: { url: string; color: string }[];
}

export type ProductSearchIntent = {
  colors: string[];
  sizes: string[];
  productTerms: string[];
  maxPrice: number | null;
  sortBy: "relevance" | "price_asc" | "price_desc";
};

const PRODUCT_TERM_ALIASES: Array<{ match: RegExp; term: string }> = [
  {
    match: /\b(head[\s-]?phones?|headphones?|ear[\s-]?pods?|earbuds?|earphones?)\b/i,
    term: "headphone",
  },
  { match: /\b(jackets?|coats?|blazers?)\b/i, term: "jacket" },
  // catches glasses / glases / glasess / eyeglasses / sunglasses
  {
    match: /\b(g+l+a+s{1,3}e*s*|eye\s*glasses?|sun\s*glasses?|eyewear|spectacles?)\b/i,
    term: "glass",
  },
  { match: /\b(watches?|wristwatch(?:es)?|straps?|strapes?)\b/i, term: "watch" },
  { match: /\b(shirts?|t[\s-]?shirts?|tees?)\b/i, term: "shirt" },
  { match: /\b(pants?|trousers?|jeans?)\b/i, term: "pant" },
  { match: /\b(phones?|mobiles?|smartphones?)\b/i, term: "phone" },
  { match: /\b(baskets?|bags?)\b/i, term: "basket" },
  { match: /\b(hats?|caps?|beanies?)\b/i, term: "hat" },
  { match: /\b(bottles?)\b/i, term: "bottle" },
  { match: /\b(covers?|cases?)\b/i, term: "cover" },
];

/** Synonyms / common typos used for text search + ranking. */
const TERM_SYNONYMS: Record<string, string[]> = {
  glass: [
    "glass",
    "glasses",
    "eyewear",
    "spectacle",
    "spectacles",
    "sunglass",
    "sunglasses",
    "glases",
    "glasess",
    "glassess",
  ],
  headphone: ["headphone", "headphones", "earpod", "earpods", "earbud", "earbuds", "earphone"],
  jacket: ["jacket", "jackets", "coat", "coats", "blazer"],
  watch: ["watch", "watches", "wristwatch", "strap", "straps", "strapes"],
  shirt: ["shirt", "shirts", "tshirt", "tee"],
  pant: ["pant", "pants", "trouser", "trousers", "jean", "jeans"],
  phone: ["phone", "phones", "mobile", "smartphone"],
  basket: ["basket", "baskets", "bag", "bags"],
  hat: ["hat", "hats", "cap", "caps", "beanie"],
  bottle: ["bottle", "bottles"],
  cover: ["cover", "covers", "case", "cases"],
};

/** Correct spellings only — used to prefer clean catalog titles over typo listings. */
const TERM_CANONICAL: Record<string, string[]> = {
  glass: ["glass", "glasses", "eyewear", "spectacle", "spectacles", "sunglass", "sunglasses"],
  headphone: ["headphone", "headphones", "earpod", "earpods", "earbud", "earbuds", "earphone"],
  jacket: ["jacket", "jackets", "coat", "coats", "blazer"],
  watch: ["watch", "watches", "wristwatch", "strap", "straps"],
  shirt: ["shirt", "shirts", "tshirt", "tee"],
  pant: ["pant", "pants", "trouser", "trousers", "jean", "jeans"],
  phone: ["phone", "phones", "mobile", "smartphone"],
  basket: ["basket", "baskets", "bag", "bags"],
  hat: ["hat", "hats", "cap", "caps", "beanie"],
  bottle: ["bottle", "bottles"],
  cover: ["cover", "covers", "case", "cases"],
};

const TERM_CONFLICTS: Record<string, string[]> = {
  glass: ["watch", "phone", "headphone", "hat", "pant", "jacket"],
  watch: ["glass", "phone", "headphone"],
  headphone: ["watch", "phone", "glass"],
  phone: ["watch", "headphone", "glass"],
  jacket: ["pant", "shirt", "hat"],
  pant: ["jacket", "shirt", "hat"],
};

const INTENT_STOP_WORDS = new Set([
  "i",
  "me",
  "my",
  "we",
  "you",
  "your",
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "and",
  "or",
  "but",
  "is",
  "are",
  "am",
  "be",
  "was",
  "were",
  "do",
  "does",
  "did",
  "done",
  "have",
  "has",
  "had",
  "want",
  "wanna",
  "need",
  "looking",
  "find",
  "show",
  "get",
  "buy",
  "please",
  "pls",
  "some",
  "any",
  "only",
  "with",
  "without",
  "under",
  "below",
  "less",
  "than",
  "more",
  "most",
  "cheapest",
  "expensive",
  "lowest",
  "highest",
  "budget",
  "affordable",
  "premium",
  "color",
  "colour",
  "size",
  "stock",
  "available",
  "product",
  "products",
  "item",
  "items",
  "store",
  "order",
  "recommend",
  "recommendation",
  "something",
  "anything",
  "everything",
  "hello",
  "hey",
  "hi",
  "thanks",
  "thank",
  "help",
  "how",
  "what",
  "who",
  "when",
  "where",
  "why",
  "which",
  "can",
  "could",
  "would",
  "should",
  "will",
  "this",
  "that",
  "these",
  "those",
  "about",
  "tell",
  "give",
  "list",
  "see",
  "there",
  "here",
  "just",
  "also",
  "like",
  "from",
  "into",
  "out",
  "up",
  "down",
  "all",
  "one",
  "two",
  "few",
  "many",
  "much",
  "very",
  "really",
  "still",
  "again",
  "ok",
  "okay",
  "yes",
  "no",
  "not",
  "dont",
  "don't",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

export function hasSpecificSearchIntent(intent: ProductSearchIntent): boolean {
  return (
    intent.productTerms.length > 0 ||
    intent.colors.length > 0 ||
    intent.sizes.length > 0 ||
    intent.maxPrice != null
  );
}

export function parseProductSearchIntent(query: string): ProductSearchIntent {
  const normalized = normalizeText(query);
  const colors: string[] = [];

  for (const color of PRODUCT_COLOR_OPTIONS) {
    const colorNorm = normalizeText(color);
    const colorCompact = compactText(color);
    if (normalized.includes(colorNorm) || compactText(normalized).includes(colorCompact)) {
      colors.push(color.toLowerCase());
    }
  }
  if (/\bgrey\b/.test(normalized) && !colors.includes("gray")) colors.push("gray");

  const sizes: string[] = [];
  const sizeMention = query.match(/\bsize\s*(xs|s|m|l|xl|xxl|free\s*size|one\s*size|fixed)\b/i);
  if (sizeMention) {
    sizes.push(normalizeText(sizeMention[1]));
  }
  for (const size of PRODUCT_SIZE_OPTIONS) {
    const sizeNorm = normalizeText(size);
    if (sizeNorm.length <= 2) continue;
    const sizeRe = new RegExp(`\\b${sizeNorm.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (sizeRe.test(normalized) && !sizes.includes(sizeNorm)) {
      sizes.push(sizeNorm);
    }
  }

  const productTerms: string[] = [];
  for (const alias of PRODUCT_TERM_ALIASES) {
    if (alias.match.test(query) && !productTerms.includes(alias.term)) {
      productTerms.push(alias.term);
    }
  }

  if (productTerms.length === 0) {
    const colorSet = new Set(colors.map((c) => compactText(c)));
    const sizeSet = new Set(sizes.map((s) => compactText(s)));
    for (const token of normalized.split(/\s+/)) {
      if (token.length < 3) continue;
      if (INTENT_STOP_WORDS.has(token)) continue;
      if (/^\d+(\.\d+)?$/.test(token)) continue;
      if (colorSet.has(compactText(token))) continue;
      if (sizeSet.has(compactText(token))) continue;
      const singular = token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
      if (!productTerms.includes(singular)) productTerms.push(singular);
    }
  }

  let maxPrice: number | null = null;
  const underMatch = query.match(/(?:under|below|less than|<=?)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  if (underMatch) maxPrice = Number(underMatch[1]);

  let sortBy: ProductSearchIntent["sortBy"] = "relevance";
  if (/\b(cheapest|lowest|low[\s-]?price|budget|affordable|inexpensive)\b/i.test(query)) {
    sortBy = "price_asc";
  } else if (/\b(expensive|highest|premium|costliest|most\s+expensive)\b/i.test(query)) {
    sortBy = "price_desc";
  } else if (maxPrice != null) {
    sortBy = "price_asc";
  }

  return { colors, sizes, productTerms, maxPrice, sortBy };
}

function matchingVariantSpecs(
  product: RetrievedProduct,
  intent: ProductSearchIntent
): RetrievedProduct["specifications"] {
  return product.specifications.filter((s) => {
    if (s.qty <= 0) return false;
    if (intent.colors.length > 0) {
      const ok = intent.colors.some((c) => s.color.toLowerCase() === c.toLowerCase());
      if (!ok) return false;
    }
    if (intent.sizes.length > 0) {
      const sizeNorm = normalizeText(s.size);
      const ok = intent.sizes.some(
        (size) => sizeNorm === size || compactText(sizeNorm) === compactText(size)
      );
      if (!ok) return false;
    }
    return true;
  });
}

function productMatchesVariantIntent(
  product: RetrievedProduct,
  intent: ProductSearchIntent
): boolean {
  const needsVariant = intent.colors.length > 0 || intent.sizes.length > 0;
  if (!needsVariant) return true;

  const matches = matchingVariantSpecs(product, intent);
  if (matches.length > 0) return true;

  if (product.specifications.length === 0) {
    const colorOk =
      intent.colors.length === 0 ||
      intent.colors.some((c) => product.color?.toLowerCase() === c.toLowerCase());
    const sizeOk =
      intent.sizes.length === 0 ||
      intent.sizes.some(
        (size) =>
          product.size != null &&
          (normalizeText(product.size) === size || compactText(product.size) === compactText(size))
      );
    return colorOk && sizeOk && product.stock > 0;
  }

  return false;
}

function resolveProductImage(
  product: Pick<RetrievedProduct, "image" | "galleryImages" | "color">,
  preferredColor?: string | null
): string {
  const gallery = product.galleryImages || [];
  const color = (preferredColor ?? product.color ?? "").trim().toLowerCase();

  if (color) {
    const match = gallery.find((img) => img.color.trim().toLowerCase() === color);
    if (match?.url) return match.url;
  }

  const uncolored = gallery.find((img) => !img.color.trim());
  if (uncolored?.url) return uncolored.url;
  if (gallery[0]?.url) return gallery[0].url;
  return product.image;
}

function withResolvedImage(
  product: RetrievedProduct,
  preferredColor?: string | null
): RetrievedProduct {
  return {
    ...product,
    image: resolveProductImage(product, preferredColor),
  };
}

function projectProductToIntent(
  product: RetrievedProduct,
  intent: ProductSearchIntent
): RetrievedProduct {
  const needsVariant = intent.colors.length > 0 || intent.sizes.length > 0;
  if (!needsVariant) return withResolvedImage(product);

  const matchingSpecs = matchingVariantSpecs(product, intent);
  if (matchingSpecs.length === 0) return withResolvedImage(product);

  const stock = matchingSpecs.reduce((sum, s) => sum + s.qty, 0);
  const color = matchingSpecs[0].color;
  return withResolvedImage(
    {
      ...product,
      color,
      size: matchingSpecs[0].size,
      stock,
      specifications: matchingSpecs,
    },
    color
  );
}

async function hydrateGalleryImages(products: RetrievedProduct[]): Promise<RetrievedProduct[]> {
  if (products.length === 0) return products;

  const images = await prisma.productImage.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
    select: { productId: true, url: true, color: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const byProduct = new Map<string, { url: string; color: string }[]>();
  for (const img of images) {
    const list = byProduct.get(img.productId) || [];
    list.push({ url: img.url, color: img.color || "" });
    byProduct.set(img.productId, list);
  }

  return products.map((p) => {
    const galleryImages = byProduct.get(p.id) || [];
    return withResolvedImage({ ...p, galleryImages }, p.color);
  });
}

function stripGalleryForClient(products: RetrievedProduct[]): RetrievedProduct[] {
  return products.map(({ galleryImages: _gallery, ...rest }) => rest);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = a[i] === b[j] ? row[j] : 1 + Math.min(row[j], row[j + 1], prev);
      row[j] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function synonymsForTerm(term: string): string[] {
  return TERM_SYNONYMS[term] || [term, `${term}s`];
}

function titleMatchQuality(title: string, term: string): number {
  const tokens = normalizeText(title).split(/\s+/).filter(Boolean);
  const syns = TERM_CANONICAL[term] || synonymsForTerm(term);
  let best = 0;
  for (const token of tokens) {
    for (const syn of syns) {
      if (token === syn) best = Math.max(best, 1);
      else if (token.startsWith(syn) || syn.startsWith(token)) best = Math.max(best, 0.75);
      else if (syn.length >= 4 && token.length >= 4 && levenshtein(token, syn) <= 2) {
        best = Math.max(best, 0.45);
      }
    }
  }
  return best;
}

function categoryMatchQuality(categoryName: string | null, term: string): number {
  if (!categoryName) return 0;
  const cat = normalizeText(categoryName);
  const syns = synonymsForTerm(term);
  if (syns.some((s) => cat === s)) return 1;
  if (syns.some((s) => cat.includes(s))) return 0.8;
  return 0;
}

function inferFamilyFromText(text: string): string | null {
  const n = normalizeText(text);
  const compact = compactText(n);
  for (const [term, syns] of Object.entries(TERM_SYNONYMS)) {
    if (
      syns.some(
        (s) => n === s || new RegExp(`\\b${s}\\b`).test(n) || compact.includes(compactText(s))
      )
    ) {
      return term;
    }
  }
  return null;
}

function productConflictsWithTerm(product: RetrievedProduct, term: string): boolean {
  const conflicts = TERM_CONFLICTS[term] || [];
  if (conflicts.length === 0) return false;
  const catFamily = inferFamilyFromText(product.categoryName || "");
  return Boolean(catFamily && catFamily !== term && conflicts.includes(catFamily));
}

function productMatchesTerm(product: RetrievedProduct, term: string): boolean {
  if (productConflictsWithTerm(product, term)) return false;

  const syns = synonymsForTerm(term);
  const hay = normalizeText(`${product.title} ${product.categoryName || ""}`);
  const hayCompact = compactText(hay);

  if (syns.some((s) => hay.includes(s) || hayCompact.includes(compactText(s)))) return true;
  if (titleMatchQuality(product.title, term) >= 0.45) return true;
  if (categoryMatchQuality(product.categoryName, term) >= 0.8) return true;

  return false;
}

function typeRelevanceScore(product: RetrievedProduct, intent: ProductSearchIntent): number {
  let score = product.similarity;
  for (const term of intent.productTerms) {
    score += titleMatchQuality(product.title, term) * 0.45;
    score += categoryMatchQuality(product.categoryName, term) * 0.35;
    if (productConflictsWithTerm(product, term)) score -= 1;
  }
  if (
    (intent.colors.length > 0 || intent.sizes.length > 0) &&
    productMatchesVariantIntent(product, intent)
  ) {
    score += 0.12;
  }
  return score;
}

/**
 * Prefer clean title matches over typo-only listings when a strong match exists.
 * If color/size was asked but only weak titles have that variant, keep strong type matches.
 */
function preferStrongTypeMatches(
  products: RetrievedProduct[],
  intent: ProductSearchIntent
): RetrievedProduct[] {
  if (intent.productTerms.length === 0 || products.length <= 1) return products;

  const scored = products.map((p) => ({
    p,
    q: Math.max(...intent.productTerms.map((t) => titleMatchQuality(p.title, t))),
  }));
  const strong = scored.filter((s) => s.q >= 0.7).map((s) => s.p);
  if (strong.length === 0) return products;

  const needsVariant = intent.colors.length > 0 || intent.sizes.length > 0;
  if (needsVariant) {
    const strongVariant = strong.filter((p) => productMatchesVariantIntent(p, intent));
    if (strongVariant.length > 0) {
      return strongVariant.map((p) => projectProductToIntent(p, intent));
    }
    return strong;
  }

  return strong;
}

/**
 * Keep only products that satisfy explicit color / type / size / price constraints.
 * Returns [] when the query has no specific intent (avoids random vector neighbors).
 */
export function filterProductsByIntent(
  products: RetrievedProduct[],
  intent: ProductSearchIntent
): RetrievedProduct[] {
  if (!hasSpecificSearchIntent(intent)) return [];

  let result = products;

  if (intent.productTerms.length > 0) {
    const byTerm = result.filter((p) =>
      intent.productTerms.some((term) => productMatchesTerm(p, term))
    );
    if (byTerm.length > 0) result = byTerm;
    else return [];
  }

  const beforeStrong = result;
  result = preferStrongTypeMatches(result, intent);

  const usedStrongFallback =
    intent.productTerms.length > 0 &&
    (intent.colors.length > 0 || intent.sizes.length > 0) &&
    result !== beforeStrong &&
    result.every(
      (p) => Math.max(...intent.productTerms.map((t) => titleMatchQuality(p.title, t))) >= 0.7
    ) &&
    !result.some((p) => productMatchesVariantIntent(p, intent));

  if (!usedStrongFallback && (intent.colors.length > 0 || intent.sizes.length > 0)) {
    const byVariant = result.filter((p) => productMatchesVariantIntent(p, intent));
    if (byVariant.length > 0) {
      result = byVariant.map((p) => projectProductToIntent(p, intent));
    } else if (intent.productTerms.length === 0) {
      return [];
    }
  }

  if (intent.maxPrice != null) {
    const byPrice = result.filter((p) => p.price <= intent.maxPrice!);
    if (byPrice.length > 0) result = byPrice;
    else return [];
  }

  if (intent.sortBy === "price_asc") {
    result = [...result].sort((a, b) => a.price - b.price || b.similarity - a.similarity);
  } else if (intent.sortBy === "price_desc") {
    result = [...result].sort((a, b) => b.price - a.price || b.similarity - a.similarity);
  } else {
    result = [...result].sort(
      (a, b) => typeRelevanceScore(b, intent) - typeRelevanceScore(a, intent)
    );
  }

  return result;
}

async function findProductsByTextTerms(terms: string[]): Promise<RetrievedProduct[]> {
  const synonyms = [...new Set(terms.flatMap((t) => synonymsForTerm(t)))];
  if (synonyms.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: synonyms.flatMap((s) => [
        { title: { contains: s, mode: "insensitive" as const } },
        { category: { name: { contains: s, mode: "insensitive" as const } } },
      ]),
    },
    take: 40,
    select: {
      id: true,
      title: true,
      price: true,
      color: true,
      size: true,
      stock: true,
      image: true,
      isActive: true,
      category: { select: { name: true } },
      specifications: {
        select: { color: true, size: true, qty: true, sku: true },
      },
      images: {
        select: { url: true, color: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return rows.map((p) => {
    const galleryImages = (p.images || []).map((img) => ({
      url: img.url,
      color: img.color || "",
    }));
    return withResolvedImage(
      {
        id: p.id,
        title: p.title,
        price: Number(p.price),
        color: p.color,
        size: p.size,
        stock: p.stock,
        image: p.image,
        isActive: p.isActive,
        categoryName: p.category?.name ?? null,
        similarity: 0.35,
        specifications: p.specifications,
        galleryImages,
      },
      p.color
    );
  });
}

function mergeProductCandidates(
  vectorHits: RetrievedProduct[],
  textHits: RetrievedProduct[]
): RetrievedProduct[] {
  const byId = new Map<string, RetrievedProduct>();
  for (const p of textHits) byId.set(p.id, p);
  for (const p of vectorHits) {
    const existing = byId.get(p.id);
    if (!existing || p.similarity > existing.similarity) {
      byId.set(p.id, {
        ...p,
        specifications:
          p.specifications.length > 0 ? p.specifications : existing?.specifications || [],
        galleryImages:
          (p.galleryImages && p.galleryImages.length > 0
            ? p.galleryImages
            : existing?.galleryImages) || [],
      });
    } else if (existing) {
      byId.set(p.id, {
        ...existing,
        galleryImages:
          (existing.galleryImages && existing.galleryImages.length > 0
            ? existing.galleryImages
            : p.galleryImages) || [],
      });
    }
  }
  return [...byId.values()];
}

/**
 * Searches for products using pgvector, then applies query-intent filters.
 */
export async function searchSimilarProducts(
  embedding: number[],
  limit = 5,
  minSimilarity = 0.15,
  queryText?: string
): Promise<RetrievedProduct[]> {
  const intent = queryText?.trim() ? parseProductSearchIntent(queryText) : null;

  // Vague prompts ("hi", "recommend something") must not surface random catalog hits.
  if (intent && !hasSpecificSearchIntent(intent)) {
    return [];
  }

  const vecStr = `[${embedding.join(",")}]`;
  const candidateLimit = Math.max(limit * 4, 20);

  const rawProducts = await (
    prisma as unknown as {
      $queryRawUnsafe: (
        query: string,
        ...params: unknown[]
      ) => Promise<
        {
          id: string;
          title: string;
          price: unknown;
          color: string | null;
          size: string | null;
          stock: number;
          image: string;
          isActive: boolean;
          categoryName: string | null;
          similarity: number;
        }[]
      >;
    }
  ).$queryRawUnsafe(
    `SELECT 
      p.id, 
      p.title, 
      p.price, 
      p.color, 
      p.size, 
      p.stock, 
      p.image, 
      p."isActive",
      c.name as "categoryName",
      (1 - (p.embedding <=> $1::vector)) AS similarity
    FROM "Product" p
    LEFT JOIN "Category" c ON p."categoryId" = c.id
    WHERE p."isActive" = true 
      AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> $1::vector ASC
    LIMIT $2;`,
    vecStr,
    candidateLimit
  );

  const filtered = (rawProducts || []).filter((p) => p.similarity >= minSimilarity);

  const productIds = filtered.map((p) => p.id);
  const specs =
    productIds.length > 0
      ? await prisma.specification.findMany({
          where: { productId: { in: productIds } },
          select: {
            productId: true,
            color: true,
            size: true,
            qty: true,
            sku: true,
          },
        })
      : [];

  const specsByProduct = new Map<string, typeof specs>();
  for (const s of specs) {
    const list = specsByProduct.get(s.productId) || [];
    list.push(s);
    specsByProduct.set(s.productId, list);
  }

  let products: RetrievedProduct[] = filtered.map((p) => ({
    id: p.id,
    title: p.title,
    price: Number(p.price),
    color: p.color,
    size: p.size,
    stock: p.stock,
    image: p.image,
    isActive: p.isActive,
    categoryName: p.categoryName,
    similarity: Number(p.similarity),
    specifications: specsByProduct.get(p.id) || [],
  }));

  if (intent?.productTerms.length) {
    const textHits = await findProductsByTextTerms(intent.productTerms);
    products = mergeProductCandidates(products, textHits);
  }

  products = await hydrateGalleryImages(products);

  if (products.length === 0) {
    return [];
  }

  if (intent) {
    products = filterProductsByIntent(products, intent);
  }

  products = products.map((p) => withResolvedImage(p, p.color));

  return stripGalleryForClient(products).slice(0, limit);
}

/**
 * Constructs the contextual prompt containing ONLY the retrieved products.
 */
export function buildRagPromptContext(products: RetrievedProduct[]): string {
  if (products.length === 0) {
    return "NO_PRODUCTS_FOUND: No matching products were found in the catalog for this query.";
  }

  return products
    .map((p, index) => {
      const specVariants = p.specifications
        .map(
          (s) =>
            `- Variant: Color=${s.color}, Size=${s.size}, AvailableQty=${s.qty}${s.sku ? `, SKU=${s.sku}` : ""}`
        )
        .join("\n  ");

      return `[Product #${index + 1}]
- ID: ${p.id}
- Title: ${p.title}
- Category: ${p.categoryName || "General"}
- Price: $${p.price.toFixed(2)}
- Default Color: ${p.color || "Standard"}
- Default Size: ${p.size || "Standard"}
- Total Stock: ${p.stock > 0 ? `${p.stock} units available` : "Out of stock"}
- Variants:
  ${specVariants || "None specified"}`;
    })
    .join("\n\n");
}

export const SYSTEM_RAG_PROMPT = `You are a shopping assistant for "Bhai ka Store" only.

SCOPE (STRICT):
- Answer ONLY questions about this store's products, prices, stock, colors, sizes, categories, and shopping help for Bhai ka Store.
- If the user asks about anything unrelated (coding, games, homework, politics, general knowledge, other websites, how-to tutorials, etc.), refuse politely in one or two short sentences. Example:
  "I can only help with Bhai ka Store products and shopping. Ask me about items, prices, sizes, or stock."
- Do NOT provide code, tutorials, essays, or advice outside the store catalog.

GROUNDING:
1. Use ONLY the RETRIEVED PRODUCT CONTEXT below. Never invent products, prices, stock, or policies.
2. If the context is "NO_PRODUCTS_FOUND" or nothing matches, say:
   "I don't have that information. Our store currently does not have matching products for that request in our catalog."
3. Prefer the best overall match for the asked product type (clear title/category). If the exact color/size is missing on the best match, say so and still recommend that product when appropriate — do not push poorly named / likely mismatched listings over a clear match.
4. Only recommend products that match the user's asked product type. Never list unrelated categories.
5. If the user asked for a specific color or size and it exists on a strong match, use that variant's stock. Do not invent colors.
6. When the user asks for cheapest / most expensive / under a price, respect that order and only list matching items.
7. When listing products, use a short bullet list (not markdown tables). For each item include title, price as $XX.XX, the matching color/size if known, and stock for that variant.
8. You may link products as: [View Product](/products/{ID})
9. Keep answers concise and professional. Never continue with off-topic content after a store answer.`;
