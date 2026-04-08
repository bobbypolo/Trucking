import React, { useState, useEffect } from "react";
import { CheckCircle2, X, Loader2 } from "lucide-react";
import { getIdTokenAsync } from "../services/authService";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

interface LoadRow {
  id: string;
  load_number: string;
  status: string;
  intake_source: string;
  driver_id?: string;
  pickup_city?: string;
  pickup_state?: string;
  dropoff_city?: string;
  dropoff_state?: string;
}

interface Equipment {
  id: string;
  unit_number?: string;
  type?: string;
}

interface Props {
  onLoadApproved?: (loadId: string) => void;
}

/**
 * PendingDriverIntakeQueue — dispatcher view of loads submitted by drivers
 * (status=Draft AND intake_source=driver). Approval requires equipment selection
 * then fires two sequential PATCHes: equipment_id, then status=Planned.
 */
export const PendingDriverIntakeQueue: React.FC<Props> = ({
  onLoadApproved,
}) => {
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalLoadId, setApprovalLoadId] = useState<string | null>(null);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [approving, setApproving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchLoads = async () => {
      try {
        const token = (await getIdTokenAsync()) ?? "";
        const res = await fetch(`${API_BASE}/loads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: LoadRow[] = await res.json();
        if (!cancelled) {
          setLoads(
            data.filter(
              (l) => l.status === "draft" && l.intake_source === "driver",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLoads();
    return () => {
      cancelled = true;
    };
  }, []);

  const openApprovalModal = async (loadId: string) => {
    setApprovalLoadId(loadId);
    setSelectedEquipmentId("");
    setErrorMsg(null);
    try {
      const token = (await getIdTokenAsync()) ?? "";
      const res = await fetch(`${API_BASE}/equipment`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEquipmentList(Array.isArray(data) ? data : (data.equipment ?? []));
      }
    } catch {
      // non-fatal — list stays empty
    }
  };

  const handleApprove = async () => {
    if (!approvalLoadId || !selectedEquipmentId) return;
    setApproving(true);
    setErrorMsg(null);
    try {
      const token = (await getIdTokenAsync()) ?? "";

      // First PATCH: set equipment_id
      const patchEq = await fetch(`${API_BASE}/loads/${approvalLoadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ equipment_id: selectedEquipmentId }),
      });
      if (!patchEq.ok) {
        const err = (await patchEq.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Failed to assign equipment");
      }

      // Second PATCH: transition status to Planned
      const patchStatus = await fetch(
        `${API_BASE}/loads/${approvalLoadId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "Planned" }),
        },
      );
      if (!patchStatus.ok) {
        const err = (await patchStatus.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Failed to update status");
      }

      setLoads((prev) => prev.filter((l) => l.id !== approvalLoadId));
      onLoadApproved?.(approvalLoadId);
      setApprovalLoadId(null);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
        Pending Driver Intake ({loads.length})
      </h3>

      {loads.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-6">
          No pending driver intake loads.
        </p>
      )}

      {loads.map((load) => (
        <div
          key={load.id}
          className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex justify-between items-center"
          data-testid={`intake-row-${load.id}`}
        >
          <div className="space-y-1">
            <p className="text-xs font-black text-white uppercase">
              {load.load_number}
            </p>
            {load.pickup_city && (
              <p className="text-[10px] text-slate-500">
                {load.pickup_city} → {load.dropoff_city}
              </p>
            )}
          </div>
          <button
            onClick={() => openApprovalModal(load.id)}
            className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-500/20 transition-all"
            data-testid={`approve-btn-${load.id}`}
          >
            Approve
          </button>
        </div>
      ))}

      {/* Approval Modal */}
      {approvalLoadId && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#0a0f1e] rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                Approve Load
              </h3>
              <button
                onClick={() => setApprovalLoadId(null)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Assign Equipment *
              </label>
              <select
                value={selectedEquipmentId}
                onChange={(e) => setSelectedEquipmentId(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                data-testid="equipment-select"
              >
                <option value="">Select equipment…</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.unit_number ?? eq.type ?? eq.id}
                  </option>
                ))}
              </select>
            </div>

            {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

            <button
              onClick={handleApprove}
              disabled={!selectedEquipmentId || approving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              data-testid="approve-confirm-btn"
            >
              {approving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Approving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
