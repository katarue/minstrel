const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

function toJST(iso: string): Date {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
}

export function formatDateShort(iso: string, locale: string): string {
  const jst = toJST(iso);
  if (locale === "en") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", weekday: "short", timeZone: "UTC",
    }).format(jst);
  }
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const w = WEEKDAYS_JA[jst.getUTCDay()];
  return `${m}月${d}日（${w}）`;
}

export function formatDateFull(iso: string, locale: string): string {
  const jst = toJST(iso);
  if (locale === "en") {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "UTC",
    }).format(jst);
  }
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const w = WEEKDAYS_JA[jst.getUTCDay()];
  return `${y}年${m}月${d}日（${w}）`;
}

export function formatDateRange(startIso: string, endIso: string, locale: string): string {
  const jstS = toJST(startIso);
  const jstE = toJST(endIso);

  if (locale === "en") {
    const fmtFull = new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", weekday: "short", timeZone: "UTC",
    });
    if (startIso === endIso) return fmtFull.format(jstS);
    if (jstS.getUTCMonth() === jstE.getUTCMonth()) {
      const dayEnd = new Intl.DateTimeFormat("en-US", {
        day: "numeric", weekday: "short", timeZone: "UTC",
      }).format(jstE);
      return `${fmtFull.format(jstS)} – ${dayEnd}`;
    }
    return `${fmtFull.format(jstS)} – ${fmtFull.format(jstE)}`;
  }

  const sm = jstS.getUTCMonth() + 1;
  const sd = jstS.getUTCDate();
  const sw = WEEKDAYS_JA[jstS.getUTCDay()];
  if (startIso === endIso) return `${sm}月${sd}日（${sw}）`;
  const em = jstE.getUTCMonth() + 1;
  const ed = jstE.getUTCDate();
  const ew = WEEKDAYS_JA[jstE.getUTCDay()];
  if (sm === em) return `${sm}月${sd}日（${sw}）〜${ed}日（${ew}）`;
  return `${sm}月${sd}日（${sw}）〜${em}月${ed}日（${ew}）`;
}
