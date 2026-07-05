/** Форматирование секунд в mm:ss */
export function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** URL обложки Яндекс.Музыки */
export function coverUrl(uri: string, size = "200x200"): string {
  return `https://${uri.replace("%%", size)}`;
}
