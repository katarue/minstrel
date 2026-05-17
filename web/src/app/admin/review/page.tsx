import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { RecordList, type EventRecord } from "./RecordList";
import { UrlIngestForm } from "./UrlIngestForm";
import { ScreenshotIngestForm } from "./ScreenshotIngestForm";

export const revalidate = 0;
export const maxDuration = 60;

async function getEventRecords(): Promise<EventRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select(`
      id, event_name, start_datetime, venue_name, prefecture,
      source_url, official_url, reference_url, flyer_image_url, key_visual_url, is_published,
      organizers(name),
      event_game_titles(game_titles(title_name)),
      event_sources(source_name, raw_data)
    `)
    .order("start_datetime", { ascending: true });

  if (error) {
    console.error("[admin/records]", error);
    return [];
  }
  return (data ?? []) as unknown as EventRecord[];
}

export default async function ReviewPage() {
  const events = await getEventRecords();
  const unpublishedCount = events.filter(e => !e.is_published).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
            >
              ← ダッシュボード
            </Link>
          </div>
          <h1 className="font-heading text-ink-heading text-2xl font-semibold">
            イベント管理
          </h1>
          <p className="text-sm text-ink-body/60 mt-0.5">
            全イベントの管理・公開制御
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-body/40 mt-2">
          全 {events.length} 件（未公開 {unpublishedCount} 件）
        </span>
      </div>

      <UrlIngestForm />
      <ScreenshotIngestForm />

      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
        <RecordList events={events} />
      </div>
    </div>
  );
}
