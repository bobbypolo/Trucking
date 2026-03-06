import React, { useMemo } from 'react';
import {
    Clock, MapPin, Truck, AlertCircle, CheckCircle2,
    MessageSquare, User, History, ChevronRight
} from 'lucide-react';
import { DispatchEvent, TimeLog, LoadData } from '../types';

interface Props {
    events: DispatchEvent[];
    timeLogs: TimeLog[];
    loads: LoadData[];
}

export const DispatcherTimeline: React.FC<Props> = ({ events, timeLogs, loads }) => {
    const mergedTimeline = useMemo(() => {
        const items = [
            ...events.map(e => ({
                id: e.id,
                timestamp: new Date(e.createdAt).getTime(),
                type: 'event',
                data: e,
                load: loads.find(l => l.id === e.loadId)
            })),
            ...timeLogs.map(t => ({
                id: t.id,
                timestamp: new Date(t.clockIn).getTime(),
                type: 'log',
                data: t,
                load: t.loadId ? loads.find(l => l.id === t.loadId) : null
            }))
        ];

        return items.sort((a, b) => b.timestamp - a.timestamp);
    }, [events, timeLogs, loads]);

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'StatusChange': return <History className="w-4 h-4 text-blue-500" />;
            case 'SystemAlert': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'DriverCall': return <MessageSquare className="w-4 h-4 text-indigo-500" />;
            default: return <Clock className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <div className="space-y-6">
            {mergedTimeline.length === 0 && (
                <div className="text-center py-12 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                    <History className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No activity sequences recorded</p>
                </div>
            )}

            {mergedTimeline.map((item, idx) => (
                <div key={item.id} className="relative pl-8 group">
                    {/* Vertical Line */}
                    {idx !== mergedTimeline.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-slate-800 group-hover:bg-blue-500/30 transition-colors" />
                    )}

                    {/* Node Icon */}
                    <div className="absolute left-0 top-1 w-8 h-8 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center z-10 shadow-xl group-hover:border-blue-500/50 transition-all">
                        {item.type === 'event' ? getEventIcon((item.data as DispatchEvent).eventType) : <User className="w-4 h-4 text-green-500" />}
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/30 transition-all shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter bg-slate-950 px-2 py-1 rounded">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <span className="mx-2 opacity-30">|</span>
                                {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                            {item.load && (
                                <div className="flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] font-black text-blue-400">
                                    <Truck className="w-3 h-3" /> #{item.load.loadNumber}
                                </div>
                            )}
                        </div>

                        <p className="text-sm font-bold text-white leading-relaxed">
                            {item.type === 'event'
                                ? (item.data as DispatchEvent).message
                                : `Driver Activity: ${(item.data as TimeLog).activityType}`}
                        </p>

                        {item.type === 'log' && (item.data as TimeLog).location && (
                            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                <MapPin className="w-3 h-3 text-orange-500" />
                                {/* Mock location text since we only have coords */}
                                Geocoded Terminal Entry (Lat: {(item.data as TimeLog).location?.lat.toFixed(2)})
                            </div>
                        )}

                        {item.type === 'event' && (item.data as DispatchEvent).eventType === 'StatusChange' && (
                            <div className="mt-3 flex items-center gap-2">
                                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-full opacity-30 animate-pulse" />
                                </div>
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
