import CryptoJS from "crypto-js";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { ToolResult } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type CarParams = Record<string, Record<string, string>>;
interface CarSpec { car_id: number; car_name: string; price: string; params: CarParams; }
interface SeriesData { source: string; series_name: string; cars: CarSpec[]; }

function formatSpecs(d: SeriesData): string {
  const lines = [`【${d.source}】${d.series_name}，共 ${d.cars.length} 款`];
  for (const car of d.cars.slice(0, 6)) {
    lines.push(`\n▸ ${car.car_name}${car.price ? `（${car.price}万）` : ""}`);
    for (const [cat, params] of Object.entries(car.params)) {
      const kv = Object.entries(params).map(([k, v]) => `${k}:${v}`).join("  ");
      if (kv) lines.push(`  [${cat}] ${kv}`);
    }
  }
  if (d.cars.length > 6) lines.push(`\n...（共 ${d.cars.length} 款，已截取前 6 款）`);
  return lines.join("\n");
}

function extractNextData(html: string): Record<string, unknown> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const script = doc.getElementById("__NEXT_DATA__");
  if (!script?.textContent) throw new Error("未找到 __NEXT_DATA__");
  return JSON.parse(script.textContent) as Record<string, unknown>;
}

function buildDcdParams(properties: Record<string, unknown>[], info: Record<string, unknown>): CarParams {
  const params: CarParams = {};
  let cat = "其他";
  for (const p of properties) {
    if (p["type"] === 0 || p["type"] === "0") { cat = String(p["text"] || p["key"] || "其他"); continue; }
    const key = String(p["key"] || ""), display = String(p["text"] || "");
    if (!key || !display) continue;
    const raw = info[key];
    if (raw == null) continue;
    const val = typeof raw === "object" ? String((raw as Record<string, unknown>)["value"] ?? "") : String(raw);
    if (!val) continue;
    if (!params[cat]) params[cat] = {};
    params[cat][display] = val;
  }
  return params;
}

// ── 懂车帝 ──────────────────────────────────────────────────────────────────

export async function queryDongchedi(carName: string): Promise<ToolResult> {
  try {
    const hdrs = { "User-Agent": UA, "Referer": "https://www.dongchedi.com/", "Accept-Language": "zh-CN,zh;q=0.9" };
    const sr = await tauriFetch(`https://www.dongchedi.com/search?keyword=${encodeURIComponent(carName)}&currTab=1&city_name=北京`, { headers: hdrs });
    const sd = extractNextData(await sr.text());
    const items = ((sd["props"] as Record<string, unknown>)?.["pageProps"] as Record<string, unknown>)?.["searchData"] as Record<string, unknown>;
    const seriesId = (items?.["data"] as Record<string, unknown>[])?.[0]?.["series_id"];
    if (!seriesId) return { text: `懂车帝：未找到车系「${carName}」` };

    const pr = await tauriFetch(`https://www.dongchedi.com/auto/params-carIds-x-${seriesId}`, { headers: hdrs });
    const pd = extractNextData(await pr.text());
    const rawData = (((pd["props"] as Record<string, unknown>)?.["pageProps"] as Record<string, unknown>)?.["rawData"] as Record<string, unknown>) || {};
    const carInfoList = (rawData["car_info"] as Record<string, unknown>[]) || [];
    const properties = (rawData["properties"] as Record<string, unknown>[]) || [];
    const seriesName = String(carInfoList[0]?.["series_name"] || carName);

    const cars: CarSpec[] = carInfoList.map((c) => ({
      car_id: Number(c["car_id"]),
      car_name: String(c["car_name"] || ""),
      price: String(c["official_price"] || ""),
      params: buildDcdParams(properties, (c["info"] as Record<string, unknown>) || {}),
    }));

    return { text: formatSpecs({ source: "懂车帝", series_name: seriesName, cars }) };
  } catch (e) {
    return { text: `懂车帝查询失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── 易车 ─────────────────────────────────────────────────────────────────────

const YICHE_CID = "508";
const YICHE_SK = "f48aa2d0-31e0-42a6-a7a0-64ba148262f0";
const YICHE_PK = "19DDD1FBDFF065D3A4DA777D2D7A81EC";

export async function queryYiche(carName: string): Promise<ToolResult> {
  try {
    const hdrs = { "User-Agent": UA, "Referer": "https://car.yiche.com/", "x-platform": "pc", "Accept-Language": "zh-CN,zh;q=0.9" };
    const ts = String(Date.now());
    const sign = CryptoJS.MD5(`cid=${YICHE_CID};uid=;ver=;devid=;t=${ts};key=${YICHE_SK}`).toString();
    const param = JSON.stringify({ keyword: carName });

    const sr = await tauriFetch(
      `https://mapi.yiche.com/web_app/api/v1/search/suggest?t=${ts}&sign=${sign}&devid=&uid=&ver=&cid=${YICHE_CID}&param=${encodeURIComponent(param)}`,
      { headers: hdrs },
    );
    const sd = await sr.json() as Record<string, unknown>;
    if (String(sd["status"]) !== "1") return { text: `易车：搜索失败 ${sd["message"]}` };
    const serialId = (sd["data"] as Record<string, unknown>[])?.[0]?.["id"];
    if (!serialId) return { text: `易车：未找到车系「${carName}」` };

    const ts2 = String(Date.now());
    const pj = JSON.stringify({ cityId: "201", serialId: String(serialId) });
    const sign2 = CryptoJS.MD5(`cid=${YICHE_CID}&param=${pj}${YICHE_PK}${ts2}`).toString();

    const pr = await tauriFetch(
      `https://mapi.yiche.com/web_api/car_model_api/api/v1/car/config_new_param?cid=${YICHE_CID}&param=${encodeURIComponent(pj)}`,
      { headers: { ...hdrs, "x-sign": sign2, "x-timestamp": ts2, "x-city-id": "201", "Content-Type": "application/json;charset=UTF-8" } },
    );
    const pd = await pr.json() as Record<string, unknown>;
    if (String(pd["status"]) !== "1") return { text: `易车：参配获取失败 ${pd["message"]}` };

    const allCars: Record<number, CarSpec> = {};
    let seriesName = "";
    for (const catBlock of (pd["data"] as Record<string, unknown>[]) || []) {
      const catName = String(catBlock["name"] || "");
      for (const item of (catBlock["items"] as Record<string, unknown>[]) || []) {
        const paramName = String(item["name"] || "");
        if (!paramName) continue;
        for (const pv of (item["paramValues"] as Record<string, unknown>[]) || []) {
          const carId = Number(pv["id"]);
          if (!carId) continue;
          const value = String(pv["value"] || "");
          if (!allCars[carId]) {
            allCars[carId] = { car_id: carId, car_name: "", price: "", params: {} };
            const bi = pv["baseInfoObj"] || pv["baseInfo"];
            if (bi && typeof bi === "object" && !seriesName) seriesName = String((bi as Record<string, unknown>)["name"] || "");
          }
          if (paramName === "车款名称") { allCars[carId].car_name = value; continue; }
          if (!allCars[carId].params[catName]) allCars[carId].params[catName] = {};
          allCars[carId].params[catName][paramName] = value;
        }
      }
    }

    return { text: formatSpecs({ source: "易车", series_name: seriesName || carName, cars: Object.values(allCars) }) };
  } catch (e) {
    return { text: `易车查询失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── 太平洋汽车 ───────────────────────────────────────────────────────────────

export async function queryPcauto(carName: string): Promise<ToolResult> {
  try {
    const hdrs = { "User-Agent": UA, "Referer": "https://price.pcauto.com.cn/", "Accept-Language": "zh-CN,zh;q=0.9" };
    const sr = await tauriFetch(`https://souapi.pcauto.com.cn/auto/api/keywords/suggest/v1?q=${encodeURIComponent(carName)}`, { headers: hdrs });
    const items = await sr.json() as Record<string, unknown>[];
    const series = items?.find((i) => i["isSerialGroup"]);
    if (!series) return { text: `太平洋汽车：未找到车系「${carName}」` };

    const cr = await tauriFetch(`https://price.pcauto.com.cn/sg${series["sid"]}/config.html`, { headers: hdrs });
    const html = await cr.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    let nuxtJs = "";
    for (const s of Array.from(doc.querySelectorAll("script"))) {
      const t = s.textContent || "";
      if (t.replace(/\s/g, "").includes("window.__NUXT__=")) {
        nuxtJs = t.replace(/^[\s\S]*?window\.__NUXT__\s*=\s*/, "").trim();
        break;
      }
    }
    if (!nuxtJs) return { text: "太平洋汽车：页面结构变更，无法解析" };

    // eslint-disable-next-line no-new-func
    const nuxt = new Function("return " + nuxtJs)() as Record<string, unknown>;
    const dataVals = Object.values((nuxt["data"] as Record<string, unknown>) || {});

    let paramDefs: Record<string, unknown>[] = [];
    let modelData: Record<string, unknown>[] = [];
    let seriesName = "";

    for (const v of dataVals) {
      if (!Array.isArray(v) || v.length === 0) {
        if (v && typeof v === "object" && (v as Record<string, unknown>)["serialGroupInfoVO"]) {
          seriesName = String(((v as Record<string, unknown>)["serialGroupInfoVO"] as Record<string, unknown>)?.["serialGroupName"] || "");
        }
        continue;
      }
      const first = v[0] as Record<string, unknown>;
      if (first?.["key"] !== undefined && first?.["type"] !== undefined && first?.["parentKey"] !== undefined) paramDefs = v;
      else if (first?.["modelId"] && first?.["info"]) modelData = v;
    }

    const cats: [string, string, string][] = [];
    let currentCat = "其他";
    for (const p of paramDefs) {
      if (p["type"] === 0) { currentCat = String(p["text"] || p["key"] || "其他"); continue; }
      cats.push([String(p["key"] || ""), String(p["text"] || ""), currentCat]);
    }

    const cars: CarSpec[] = modelData.map((car) => {
      const info = (car["info"] as Record<string, unknown>) || {};
      const params: CarParams = {};
      for (const [key, display, cat] of cats) {
        if (!key || !display) continue;
        const raw = info[key];
        if (raw == null) continue;
        let val = typeof raw === "object" ? String((raw as Record<string, unknown>)["value"] ?? "") : String(raw);
        if (val.includes("<")) val = val.replace(/<span[^>]*rounded-full[^>]*>\s*<\/span>/g, "有").replace(/<[^>]+>/g, "").trim();
        if (!val) continue;
        if (!params[cat]) params[cat] = {};
        params[cat][display] = val;
      }
      return { car_id: Number(car["modelId"]), car_name: String(car["modelName"] || ""), price: String(car["officialPrice"] || ""), params };
    });

    return { text: formatSpecs({ source: "太平洋汽车", series_name: seriesName || carName, cars }) };
  } catch (e) {
    return { text: `太平洋汽车查询失败：${e instanceof Error ? e.message : String(e)}` };
  }
}
