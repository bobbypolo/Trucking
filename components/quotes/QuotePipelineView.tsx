import React from "react";
import { Quote, QuoteStatus } from "../../types";
import { Plus, Clock } from "lucide-react";

interface QuotePipelineViewProps {
  quotes: Quote[];
  searchQuery: string;
  statuses: QuoteStatus[];
  getQuoteColor: (status: QuoteStatus) => string;
  onSelectQuote: (quote: Quote) => void;
  onQuickCreate: (status: QuoteStatus) => void;
}

export const QuotePipelineView: React.FC<QuotePipelineViewProps> = ({
  quotes,
  searchQuery,
  statuses,
  getQuoteColor,
  onSelectQuote,
  onQuickCreate,
}) => {
  return (
    <div className="h-full flex gap-6 p-8 overflow-x-auto no-scrollbar">
      {statuses.map((status) => (
        <div key={status} className="w-80 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getQuoteColor(status)}`}
              />
              {status}
              <span className="text-slate-500 ml-1 text-[11px] font-bold">
                ({quotes.filter((q) => q.status === status).length})
              </span>
            </h3>
            <button
              onClick={() => onQuickCreate(status)}
              className="text-slate-600 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-10">
            {quotes
              .filter((q) => q.status === status)
              .filter(
                (q) =>
                  (q.pickup?.city ?? "")
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                  (q.dropoff?.city ?? "")
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()),
              )
              .map((quote) => (
                <div
                  key={quote.id}
                  onClick={() => onSelectQuote(quote)}
                  className="bg-slate-900 border border-white/5 rounded-2xl p-5 hover:border-blue-500/40 hover:bg-slate-800/40 cursor-pointer transition-all group animate-in fade-in slide-in-from-left-2 shadow-lg"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        {quote.equipmentType}
                      </div>
                      <div className="text-sm font-black text-white uppercase tracking-tighter group-hover:text-blue-400 transition-colors">
                        {quote.pickup?.city ?? ""}, {quote.pickup?.state ?? ""}{" "}
                        → {quote.dropoff?.city ?? ""},{" "}
                        {quote.dropoff?.state ?? ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-emerald-500 tracking-tighter">
                        ${(quote.totalRate ?? 0).toLocaleString()}
                      </div>
                      {quote.margin && (
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                          Est. Margin: ${quote.margin}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {quote.ownerId?.charAt(0) || "A"}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        Last Contact: 2m ago
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase">
                        v{quote.version}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {quotes.filter((q) => q.status === status).length === 0 && (
              <div className="h-32 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  No quotes
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
