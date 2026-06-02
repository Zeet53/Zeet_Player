/**
 * Отладочный тест: достаём videoId НЕ используя item.id.
 * Задача: найти альтернативный источник videoId для ItemSection-треков.
 *
 * Запуск: npx tsx packages/core/src/yt-api/search-debug.ts
 */

import { Innertube, UniversalCache } from "youtubei.js";

function getTitle(item: any): string {
  return item.title?.toString?.() ?? item.title ?? "(no title)";
}

function safeJson(obj: any, max = 200): string {
  if (!obj) return "—";
  try { return JSON.stringify(obj).slice(0, max); } catch { return String(obj).slice(0, max); }
}

/**
 * Ищет videoId ВСЕМИ возможными способами, кроме item.id
 * Возвращает массив { source: string, value: string } — все найденные варианты
 */
function findAllVideoIds(item: any, label: string): { source: string; value: string }[] {
  const found: { source: string; value: string }[] = [];
  const push = (src: string, val: string) => {
    if (val && val.length > 5) found.push({ source: src, value: val });
  };

  // ── 1. endpoint ──
  push("endpoint.payload.videoId", item.endpoint?.payload?.videoId);
  push("endpoint.payload.browseId", item.endpoint?.payload?.browseId);
  // watchEndpoint
  if (item.endpoint?.payload?.videoId) {
    // уже записали выше
  }
  // Если endpoint типа browse — не videoId, но может быть playlist/album

  // ── 2. navigationEndpoint ──
  push("navigationEndpoint.payload.videoId", item.navigationEndpoint?.payload?.videoId);
  push("navigationEndpoint.payload.browseId", item.navigationEndpoint?.payload?.browseId);

  // ── 3. on_tap ──
  push("on_tap.payload.videoId", item.on_tap?.payload?.videoId);
  push("on_tap.payload.browseId", item.on_tap?.payload?.browseId);

  // ── 4. on_click ──
  push("on_click.payload.videoId", item.on_click?.payload?.videoId);
  push("on_click.payload.browseId", item.on_click?.payload?.browseId);

  // ── 5. thumbnail URL ──
  if (item.thumbnails) {
    for (const t of item.thumbnails) {
      const url = t.url || "";
      const m = url.match(/\/vi\/([^/?#]+)/);
      if (m) push("thumbnail URL /vi/ID/", m[1]);
    }
  }

  // ── 6. menu → navigationEndpoint ──
  if (item.menu?.items) {
    for (const mi of item.menu.items) {
      const ne = mi.navigationEndpoint;
      if (ne?.payload?.videoId) push("menu[].navigationEndpoint.payload.videoId", ne.payload.videoId);
      if (ne?.payload?.browseId) push("menu[].navigationEndpoint.payload.browseId", ne.payload.browseId);
    }
  }

  // ── 7. overlay ──
  try {
    const ov = item.overlay;
    if (ov?.content?.navigationEndpoint?.payload?.videoId)
      push("overlay.content.navigationEndpoint.payload.videoId", ov.content.navigationEndpoint.payload.videoId);
    if (ov?.content?.endpoint?.payload?.videoId)
      push("overlay.content.endpoint.payload.videoId", ov.content.endpoint.payload.videoId);
  } catch {}

  // ── 8. flex_columns (текстовые ссылки) ──
  try {
    if (item.flex_columns) {
      for (const fc of item.flex_columns) {
        // Ищем videoId в flex_columns[*].runs[*].on_tap.payload.videoId
        if (fc.runs) {
          for (const run of fc.runs) {
            push("flex_columns[].runs[].on_tap.payload.videoId", run.on_tap?.payload?.videoId);
            push("flex_columns[].runs[].on_tap.payload.browseId", run.on_tap?.payload?.browseId);
            push("flex_columns[].runs[].navigationEndpoint.payload.videoId", run.navigationEndpoint?.payload?.videoId);
          }
        }
      }
    }
  } catch {}

  // ── 9. fixed_columns ──
  try {
    if (item.fixed_columns) {
      for (const fc of item.fixed_columns) {
        if (fc.runs) {
          for (const run of fc.runs) {
            push("fixed_columns[].runs[].on_tap.payload.videoId", run.on_tap?.payload?.videoId);
          }
        }
      }
    }
  } catch {}

  // ── 10. badges → on_tap ──
  try {
    if (item.badges) {
      for (const b of item.badges) {
        push("badges[].on_tap.payload.videoId", b.on_tap?.payload?.videoId);
        push("badges[].navigationEndpoint.payload.videoId", b.navigationEndpoint?.payload?.videoId);
      }
    }
  } catch {}

  // ── 11. search в JSON (на случай если videoId есть где-то глубже) ──
  if (!found.length) {
    const fullStr = JSON.stringify(item);
    const m = fullStr.match(/"videoId":"([^"]+)"/);
    if (m) push("JSON.stringify (deep search)", m[1]);
  }

  return found;
}

async function main() {
  const yt = await Innertube.create({ cache: new UniversalCache(false), lang: "en" });

  const queries = [
    "CUPSIZE — Клей",
    "CUPSIZE - Клей",
  ];

  for (const query of queries) {
    console.log("\n" + "=".repeat(80));
    console.log(`🔍 ПОИСК: "${query}"`);
    console.log("=".repeat(80));

    const search = await yt.music.search(query);
    const sections = search.contents as any[];

    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      const secType = sec.type || "?";
      const contents = sec.contents || sec.items || [];

      for (let ii = 0; ii < contents.length; ii++) {
        const item = contents[ii];

        if (secType === "ItemSection" || secType === "MusicShelf") {
          const title = getTitle(item);
          const itemType = item.item_type || "?";
          const realId = item.id || "(empty)";

          // Симулируем что id пустой — ищем альтернативы
          const altIds = findAllVideoIds(item, `[${si}][${ii}]`);

          // Группируем что нашли
          const viaEndpoint = altIds.find(a => a.source.includes("endpoint") || a.source.includes("navigation"));
          const viaThumbnail = altIds.find(a => a.source.includes("thumbnail"));
          const viaMenu = altIds.find(a => a.source.includes("menu"));
          const viaColumns = altIds.find(a => a.source.includes("columns") || a.source.includes("flex") || a.source.includes("fixed"));
          const viaBadges = altIds.find(a => a.source.includes("badges"));
          const viaJson = altIds.find(a => a.source.includes("JSON"));

          // Приоритет: endpoint > thumbnail > menu > columns > badges > deep JSON
          const best = viaEndpoint || viaThumbnail || viaMenu || viaColumns || viaBadges || viaJson;

          const realOk = realId !== "(empty)" && realId.length > 5;
          const altOk = !!best;

          console.log(`\n[${si}][${ii}] type=${itemType.padEnd(6)} id="${(realId.length > 45 ? realId.slice(0, 45)+"..." : realId)}" title="${title.slice(0, 60)}"`);
          console.log(`    realId=${realOk ? "✅" : "❌"}  altId=${altOk ? "✅" : "❌"}  ${best ? `→ ${best.source} = ${best.value}` : "—"}`);

          if (altOk && realOk && best!.value !== realId) {
            console.log(`    ⚠️  НЕ СОВПАДАЮТ: real=${realId} alt=${best!.value}`);
          }

          // Если через endpoint не нашли — покажем что есть
          if (!viaEndpoint) {
            console.log(`    endpoint: ${safeJson(item.endpoint)}`);
            if (item.endpoint?.payload) {
              console.log(`    endpoint.payload keys: ${Object.keys(item.endpoint.payload).join(", ")}`);
            }
            console.log(`    navigationEndpoint: ${safeJson(item.navigationEndpoint)}`);
            if (item.navigationEndpoint?.payload) {
              console.log(`    navEndpoint.payload keys: ${Object.keys(item.navigationEndpoint.payload).join(", ")}`);
            }
          }

          // Если через thumbnail не нашли — покажем все URL
          if (!viaThumbnail && item.thumbnails) {
            const urls = item.thumbnails.map((t: any) => t.url || "").filter(Boolean);
            if (urls.length) console.log(`    thumbnail URLs: ${urls.slice(0, 2).join("\n                  ")}`);
          }
        } else if (secType === "MusicCardShelf") {
          const title = getTitle(sec);
          const realId = sec.on_tap?.payload?.videoId || "(no videoId)";
          const altIds = findAllVideoIds(sec, `[${si}]`);
          const best = altIds.find(a => a.source.includes("on_tap") || a.source.includes("endpoint"));
          console.log(`\n[${si}] MusicCardShelf title="${title}" videoId=${realId} alt=${best ? `✅ ${best.source}=${best.value}` : "❌"}`);
        }
      }
    }
  }

  // ── Сводка ──
  console.log("\n" + "=".repeat(80));
  console.log("СВОДКА: какие источники videoId работают для ItemSection");
  console.log("=".repeat(80));

  // Тестируем на свежем поиске с детальным разбором endpoint
  console.log("\n▶ Детальный разбор endpoint у video/song items:");
  const search3 = await yt.music.search("CUPSIZE — Клей");
  for (const sec of (search3.contents as any[])) {
    if (sec.type !== "ItemSection") continue;
    for (const item of (sec.contents || [])) {
      if (item.item_type !== "video" && item.item_type !== "song") continue;
      console.log(`\n  "${getTitle(item).slice(0, 60)}" (${item.item_type})`);
      console.log(`    id = ${item.id || "(empty)"}`);

      // endpoint
      if (item.endpoint) {
        console.log(`    endpoint.type = ${item.endpoint.type || "?"}`);
        console.log(`    endpoint.name = ${item.endpoint.name || "?"}`);
        console.log(`    endpoint.payload = ${safeJson(item.endpoint.payload, 400)}`);
      } else {
        console.log(`    endpoint = null`);
      }

      // navigationEndpoint напрямую на item
      if (item.navigationEndpoint) {
        console.log(`    navigationEndpoint = ${safeJson(item.navigationEndpoint, 300)}`);
      }

      // on_tap напрямую
      if (item.on_tap) {
        console.log(`    on_tap = ${safeJson(item.on_tap, 300)}`);
      }

      // playlistSet (иногда там videoId)
      if (item.playlistSet) {
        console.log(`    playlistSet = ${safeJson(item.playlistSet, 200)}`);
      }

      // menu → первый PlaylistItem (часто содержит videoId из текущего плейлиста)
      if (item.menu?.items) {
        for (let mi = 0; mi < Math.min(item.menu.items.length, 3); mi++) {
          const m = item.menu.items[mi];
          const mt = m.title?.toString?.() ?? m.title ?? "";
          console.log(`    menu[${mi}]: "${mt}" → ${safeJson(m.navigationEndpoint?.payload, 150)}`);
        }
      }

      // watchEndpoint в flex_columns
      if (item.flex_columns) {
        for (let fi = 0; fi < item.flex_columns.length; fi++) {
          const fc = item.flex_columns[fi];
          if (fc.runs) {
            for (let ri = 0; ri < fc.runs.length; ri++) {
              const run = fc.runs[ri];
              if (run.on_tap?.payload?.videoId) {
                console.log(`    flex[${fi}].runs[${ri}].on_tap.payload.videoId = ${run.on_tap.payload.videoId}`);
              }
            }
          }
        }
      }
    }
  }

  console.log("\n✅ Тест завершён");
}

main().catch(console.error);
