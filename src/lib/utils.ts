import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize a free-text product name into a comparable key. */
export function normalizeProductKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Categorias de corredor de mercado. */
export const CATEGORIES = [
  { value: "hortifruti", label: "Hortifrúti", emoji: "🥬", order: 1 },
  { value: "acougue", label: "Açougue", emoji: "🥩", order: 2 },
  { value: "padaria", label: "Padaria", emoji: "🥖", order: 3 },
  { value: "laticinios", label: "Laticínios", emoji: "🧀", order: 4 },
  { value: "congelados", label: "Congelados", emoji: "🧊", order: 5 },
  { value: "mercearia", label: "Mercearia", emoji: "🌾", order: 6 },
  { value: "bebidas", label: "Bebidas", emoji: "🥤", order: 7 },
  { value: "higiene", label: "Higiene", emoji: "🧴", order: 8 },
  { value: "limpeza", label: "Limpeza", emoji: "🧼", order: 9 },
  { value: "outros", label: "Outros", emoji: "📦", order: 99 },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function getCategory(value: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

const CATEGORY_KEYWORDS: Record<CategoryValue, string[]> = {
  hortifruti: ["alface", "tomate", "banana", "maca", "maçã", "cebola", "batata", "cenoura", "laranja", "abacate", "mamao", "limao", "alho", "salsa", "verdura", "fruta", "legume"],
  acougue: ["carne", "frango", "boi", "peixe", "linguica", "linguiça", "porco", "alcatra", "patinho", "coxa", "peito", "file", "filé", "salsicha", "bacon"],
  padaria: ["pao", "pão", "biscoito", "bolacha", "bolo", "rosca", "torrada", "frances"],
  laticinios: ["leite", "queijo", "manteiga", "iogurte", "requeijao", "requeijão", "creme de leite", "ricota", "mussarela"],
  congelados: ["congelado", "pizza", "hamburguer", "hambúrguer", "nuggets", "sorvete", "polpa"],
  mercearia: ["arroz", "feijao", "feijão", "macarrao", "macarrão", "oleo", "óleo", "acucar", "açúcar", "sal", "farinha", "fuba", "fubá", "molho", "extrato", "cafe", "café", "achocolatado"],
  bebidas: ["suco", "refrigerante", "agua", "água", "cerveja", "vinho", "cha", "chá", "energetico", "energético"],
  higiene: ["sabonete", "shampoo", "condicionador", "creme dental", "pasta de dente", "desodorante", "papel higienico", "higiênico", "fralda", "absorvente"],
  limpeza: ["detergente", "sabao", "sabão", "amaciante", "agua sanitaria", "sanitária", "alvejante", "esponja", "vassoura", "desinfetante", "limpador"],
  outros: [],
};

export function suggestCategory(productName: string): CategoryValue {
  const k = normalizeProductKey(productName);
  for (const c of CATEGORIES) {
    if (c.value === "outros") continue;
    if (CATEGORY_KEYWORDS[c.value].some((kw) => k.includes(normalizeProductKey(kw)))) {
      return c.value;
    }
  }
  return "outros";
}

/** Distância em km entre dois pontos geográficos (Haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Compresses an image file to a maximum dimension, returning a base64 string. */
export async function compressImage(file: File, maxDim: number = 1024, quality: number = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context creation failed"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
