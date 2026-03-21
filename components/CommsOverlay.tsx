import React, { useState, useEffect } from 'react';
import {
    Phone, X, Minus, Square, ChevronRight, MessageSquare,
    StickyNote, CreditCard, ClipboardList, Zap, Plus, Search,
    Link as LinkIcon, AlertTriangle, ArrowUpRight, BarChart3,
    Maximize2, Minimize2, Anchor, LayoutDashboard, Truck, User, Building2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CallSession, WorkspaceSession, OperationalEvent, KCIRequest, RecordLink, EntityType } from '../types';

interface CommsOverlayProps {
    session: WorkspaceSession;
    activeCallSession: CallSession | null;
    setActiveCallSession: (session: CallSession | null) => void;
    onRecordAction: (event: OperationalEvent) => Promise<void>;
    openRecordWorkspace: (type: EntityType, id: string) => void;
    onNavigate: (tab: string, context?: any) => void;
    onLinkSessionToRecord?: (sessionId: string, recordId: string, recordType: EntityType) => Promise<void>;
    overlayState: 'floating' | 'docked' | 'collapsed';
    setOverlayState: (state: 'floating' | 'docked' | 'collapsed') => void;
    user: { id: string, name: string };
    allLoads: any[];
}

export const CommsOverlay: React.FC<CommsOverlayProps> = ({
    session,
    activeCallSession,
    setActiveCallSession,
    onRecordAction,
    openRecordWorkspace,
    onNavigate,
    overlayState,
    setOverlayState,
    user,
    allLoads,
    onLinkSessionToRecord
}) => {
    const [activeTab, setActiveTab] = useState<'notes' | 'messages' | 'requests' | 'tasks'>('notes');
    const [noteText, setNoteText] = useState('');
    const [showAttachSearch, setShowAttachSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Draggable Logic
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (overlayState === 'docked') return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    if (overlayState === 'collapsed') {
        return (
            <button
                onClick={() => setOverlayState('floating')}
                className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[9999] group"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`
                }}
            >
                {activeCallSession ? (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-slate-900" />
                ) : (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
                <Phone className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
            </button>
        );
    }

    const startSession = () => {
        const newSession: CallSession = {
            id: `CALL-${uuidv4().slice(0, 8).toUpperCase()}`,
            startTime: new Date().toISOString(),
            status: 'ACTIVE',
            participants: [{ id: user.id, name: user.name, role: 'DISPATCHER' }],
            lastActivityAt: new Date().toISOString(),
            links: session.primaryContext ? [{
                id: uuidv4(),
                entityType: session.primaryContext.type,
                entityId: session.primaryContext.id,
                isPrimary: true,
                createdAt: new Date().toISOString(),
                createdBy: user.name
            }] : []
        };
        setActiveCallSession(newSession);
    };

    const handleAddNote = async () => {
        if (!noteText.trim()) return;

        await onRecordAction({
            id: uuidv4(),
            type: 'CALL_LOG',
            timestamp: new Date().toISOString(),
            actorId: user.id,
            actorName: user.name,
            message: noteText,
            loadId: session.primaryContext?.type === 'LOAD' ? session.primaryContext.id : undefined,
            payload: {
                callSessionId: activeCallSession?.id,
                notes: noteText
            }
        });
        setNoteText('');
    };

    const handleQuickRequest = async (type: string) => {
        const requestId = `REQ-${uuidv4().slice(0, 6).toUpperCase()}`;
        await onRecordAction({
            id: uuidv4(),
            type: 'REQUEST',
            timestamp: new Date().toISOString(),
            actorId: user.id,
            actorName: user.name,
            message: `Created ${type} request during interaction`,
            payload: {
                id: requestId,
                type,
                status: 'NEW',
                priority: 'NORMAL',
                requestedAmount: 0,
                links: activeCallSession?.links || []
            }
        });
        setActiveTab('requests');
    };

    const filteredLoads = allLoads.filter(l =>
        l.loadNumber?.toString().includes(searchQuery) ||
        l.driverName?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);

    const containerClasses = overlayState === 'docked'
        ? "fixed right-0 top-0 bottom-0 w-96 bg-[#0a1120]/95 backdrop-blur-2xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-[9999] flex flex-col transition-all duration-300"
        : "fixed bottom-20 right-6 w-[420px] h-[600px] bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] z-[9999] flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-10";

    const dragStyles = overlayState !== 'docked' ? {
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'auto'
    } : {};

    return (
        <div className={containerClasses} style={dragStyles}>
            {/* Header */}
            <div
                onMouseDown={handleMouseDown}
                className={`p-6 border-b border-white/5 bg-white/5 shrink-0 ${overlayState !== 'docked' ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeCallSession ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            <Phone className={`w-5 h-5 ${activeCallSession ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-black text-white uppercase tracking-tight">
                                {activeCallSession ? 'Active Interaction' : 'Operational Comms'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${activeCallSession ? 'bg-red-500' : 'bg-slate-600'}`} />
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    {activeCallSession ? activeCallSession.id : 'Idle'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setOverlayState(overlayState === 'docked' ? 'floating' : 'docked')} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                            {overlayState === 'docked' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setOverlayState('collapsed')} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                            <Minus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Active Context / Attachments Bar */}
                <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-3 flex items-center justify-between group h-12">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="shrink-0 w-6 h-6 rounded-md bg-blue-600/20 flex items-center justify-center text-blue-400">
                            {session.primaryContext?.type === 'LOAD' ? <Truck className="w-3.5 h-3.5" /> : <Anchor className="w-3.5 h-3.5" />}
                        </div>
                        <div className="truncate">
                            <span className="text-[9px] font-black text-white uppercase block truncate leading-none">
                                {session.primaryContext?.label || 'UNLINKED INTERACTION'}
                            </span>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-none mt-1">
                                Primary Evidence
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAttachSearch(!showAttachSearch)}
                        className="p-1.5 bg-white/5 hover:bg-blue-600 hover:text-white rounded-lg text-slate-500 transition-all ml-4"
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Attach Search Overlay */}
                {showAttachSearch && (
                    <div className="mt-4 animate-in slide-in-from-top-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search records to link..."
                                aria-label="Search records to link"
                                className="w-full bg-slate-950 border border-blue-500/30 rounded-xl pl-9 pr-4 py-3 text-[11px] text-white outline-none focus:border-blue-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {searchQuery && (
                            <div className="mt-2 bg-slate-950 rounded-xl border border-white/5 overflow-hidden shadow-2xl">
                                {filteredLoads.map(l => (
                                    <div
                                        key={l.id}
                                        className="w-full p-3 text-left hover:bg-white/5 group border-b border-white/5 last:border-0 flex items-center justify-between"
                                    >
                                        <div
                                            className="cursor-pointer"
                                            onClick={() => {
                                                openRecordWorkspace('LOAD', l.id);
                                                setShowAttachSearch(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="text-[10px] font-black text-white uppercase">Load #{l.loadNumber}</div>
                                            <div className="text-[8px] font-bold text-slate-500 group-hover:text-blue-100 uppercase">{l.driverName} • {l.status}</div>
                                        </div>
                                        {onLinkSessionToRecord && (
                                            <button
                                                onClick={async () => {
                                                    if (activeCallSession) {
                                                        await onLinkSessionToRecord(activeCallSession.id, l.id, 'LOAD');
                                                    }
                                                    setShowAttachSearch(false);
                                                    setSearchQuery('');
                                                }}
                                                className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-500 hover:text-white rounded-lg transition-all"
                                                title="Link to Call"
                                            >
                                                <LinkIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/5 bg-slate-950/20 px-2">
                {[
                    { id: 'notes', icon: StickyNote, label: 'Notes' },
                    { id: 'messages', icon: MessageSquare, label: 'Messages' },
                    { id: 'requests', icon: CreditCard, label: 'Requests' },
                    { id: 'tasks', icon: ClipboardList, label: 'Tasks' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex flex-col items-center py-3 gap-1 relative ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
                        {activeTab === tab.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-slate-950/40">
                {!activeCallSession && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-blue-600/5 flex items-center justify-center border border-blue-500/10">
                            <Phone className="w-8 h-8 text-blue-500/30" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[13px] font-black text-white uppercase tracking-wider">No Active Interaction</h4>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed px-10">Start an interaction to begin logging timeline events</p>
                        </div>
                        <button
                            onClick={startSession}
                            className="px-8 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/40 flex items-center gap-3"
                        >
                            <Plus className="w-4 h-4" /> Start Interaction
                        </button>
                    </div>
                )}

                {activeCallSession && activeTab === 'notes' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 space-y-4 mb-4">
                            {/* Previous session events would go here - for now just show current draft */}
                            <div className="text-center py-4 border-b border-white/5 mb-6">
                                <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em]">Session Started At {new Date(activeCallSession.startTime).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <div className="relative bg-slate-900/60 border border-white/5 rounded-[1.5rem] p-4 group focus-within:border-blue-500/50 transition-all shadow-2xl">
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                className="w-full bg-transparent text-[13px] text-white placeholder-slate-600 resize-none outline-none h-24 mb-4"
                                placeholder="Type operational note..."
                                aria-label="Operational note"
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-500"><Zap className="w-3.5 h-3.5" /></button>
                                    <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-500"><AlertTriangle className="w-3.5 h-3.5" /></button>
                                </div>
                                <button
                                    onClick={handleAddNote}
                                    className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                                >
                                    Log Note
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeCallSession && activeTab === 'messages' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 space-y-4 mb-4 overflow-y-auto no-scrollbar">
                            {(allLoads.find(l => l.id === session.primaryContext?.id)?.messages || []).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <MessageSquare className="w-8 h-8 mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">No Strategic Messages</span>
                                </div>
                            ) : (
                                (allLoads.find(l => l.id === session.primaryContext?.id)?.messages || []).map((msg: any) => (
                                    <div key={msg.id} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                                        <div className="max-w-[80%] p-3 rounded-xl text-[11px] leading-relaxed bg-slate-900 border border-white/5 text-slate-300">
                                            {msg.text}
                                        </div>
                                        <span className="text-[7px] font-bold text-slate-600 uppercase mt-1 px-1">{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white outline-none focus:border-blue-500"
                                placeholder="Send tactical message..."
                                aria-label="Send tactical message"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                        const text = e.currentTarget.value;
                                        e.currentTarget.value = '';
                                        await onRecordAction({
                                            id: uuidv4(),
                                            type: 'MESSAGE',
                                            timestamp: new Date().toISOString(),
                                            actorId: user.id,
                                            actorName: user.name,
                                            message: text,
                                            loadId: session.primaryContext?.id,
                                            payload: { text }
                                        });
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                {activeCallSession && activeTab === 'requests' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl mb-6">
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Active Context</h4>
                            <p className="text-[11px] font-bold text-white uppercase">{session.primaryContext?.label || 'Direct Interaction'}</p>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Operational Requests</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Detention', type: 'DETENTION' },
                                { label: 'Lumper Fee', type: 'LUMPER' },
                                { label: 'Layover', type: 'LAYOVER' },
                                { label: 'TONU', type: 'TONU' }
                            ].map(req => (
                                <button
                                    key={req.label}
                                    onClick={() => handleQuickRequest(req.type)}
                                    className="p-4 bg-white/5 hover:bg-blue-600/10 border border-white/5 hover:border-blue-500/30 rounded-[1.25rem] text-left group transition-all"
                                >
                                    <div className="text-[11px] font-black text-white uppercase mb-1 group-hover:text-blue-400">{req.label}</div>
                                    <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Execute Action</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions / Jump To Bar */}
            <div className="p-4 border-t border-white/5 bg-slate-950 shrink-0">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { label: 'Booking', tab: 'booking' },
                        { label: 'Safety', tab: 'safety' },
                        { label: 'Dispatch', tab: 'loads' },
                        { label: 'Customer', tab: 'brokers' }
                    ].map(jump => (
                        <button
                            key={jump.label}
                            onClick={() => onNavigate(jump.tab)}
                            className="px-4 py-2 bg-slate-900 border border-white/5 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white hover:border-blue-500/30 transition-all whitespace-nowrap"
                        >
                            {jump.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer / End Session */}
            {activeCallSession && (
                <div className="px-6 py-4 bg-red-600/5 border-t border-red-500/10 flex items-center justify-between">
                    <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Active Call Session</div>
                    <button
                        onClick={() => setActiveCallSession(null)}
                        className="px-6 py-2 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-red-500 transition-all shadow-lg shadow-red-900/20"
                    >
                        End Interaction
                    </button>
                </div>
            )}
        </div>
    );
};
