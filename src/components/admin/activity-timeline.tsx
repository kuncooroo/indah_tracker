import { ActivityAction } from "@/lib/activity-log";
import { formatDateId, cn } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  [ActivityAction.SHIPMENT_CREATED]: "Dibuat",
  [ActivityAction.SHIPMENT_UPDATED]: "Data diubah",
  [ActivityAction.STATUS_CHANGED]: "Status",
  [ActivityAction.TASK_UPDATED]: "Progress",
  [ActivityAction.TASK_CREATED]: "Tahap baru",
  [ActivityAction.TASK_DELETED]: "Tahap dihapus",
  [ActivityAction.PHOTO_UPLOADED]: "Foto",
  [ActivityAction.PHOTO_DELETED]: "Foto dihapus",
  [ActivityAction.TEMPLATE_APPLIED]: "Template",
  [ActivityAction.PROGRESS_CLEARED]: "Reset",
};

function badgeClass(action: string) {
  if (action === ActivityAction.STATUS_CHANGED) return "bg-sky-50 text-sky-800";
  if (action === ActivityAction.TASK_UPDATED) return "bg-emerald-50 text-emerald-800";
  if (action === ActivityAction.PHOTO_UPLOADED) return "bg-violet-50 text-violet-800";
  if (action === ActivityAction.TEMPLATE_APPLIED) return "bg-amber-50 text-amber-900";
  if (action === ActivityAction.PROGRESS_CLEARED || action === ActivityAction.TASK_DELETED) {
    return "bg-red-50 text-red-700";
  }
  return "bg-neutral-100 text-neutral-700";
}

export type TimelineItem = {
  id: string;
  action: string;
  summary: string;
  actorType: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: Date | string;
  beforeJson: string | null;
  afterJson: string | null;
};

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-5 py-8 text-center text-sm text-neutral-500">
        Belum ada jejak perubahan. Aktivitas akan muncul setelah update shipment / progress.
      </div>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-neutral-200 ml-3">
      {items.map((item) => {
        const actor =
          item.actorName ||
          item.actorEmail ||
          (item.actorType === "api" ? "API" : item.actorType === "system" ? "System" : "Admin");
        return (
          <li key={item.id} className="relative pb-6 pl-6 last:pb-0">
            <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-neutral-400 ring-1 ring-neutral-200" />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  badgeClass(item.action)
                )}
              >
                {ACTION_LABEL[item.action] ?? item.action}
              </span>
              <time className="text-xs text-neutral-400">{formatDateId(item.createdAt)}</time>
            </div>
            <p className="mt-1 text-sm font-medium text-neutral-900">{item.summary}</p>
            <p className="mt-0.5 text-xs text-neutral-500">oleh {actor}</p>
          </li>
        );
      })}
    </ol>
  );
}
