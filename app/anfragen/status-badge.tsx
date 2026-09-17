import type { RequestStatus } from "@/lib/constants";

// Record<RequestStatus, ...> statt Record<string, ...>: Kommt ein Status dazu,
// weist der Compiler auf die fehlende Uebersetzung hin, statt sie stillschweigend
// als englischen Rohwert anzuzeigen.
const STATUS_LABEL: Record<RequestStatus, string> = {
  open: "offen",
  accepted: "angenommen",
  declined: "abgelehnt",
  withdrawn: "zurueckgezogen",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-slate-100 text-slate-600",
  withdrawn: "bg-slate-100 text-slate-600",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
