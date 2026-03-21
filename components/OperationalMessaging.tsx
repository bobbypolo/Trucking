import React, { useState, useMemo, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Truck,
  User,
  Clock,
  ArrowLeft,
  MoreVertical,
  Paperclip,
  Smile,
  Search as SearchIcon,
  MapPin,
  Calendar,
  Phone,
  Info,
  CheckSquare,
  PlusSquare,
  Users as UsersIcon,
  Link,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import {
  User as UserType,
  LoadData,
  Message,
  GlobalSearchResult,
  CallSession,
  OperationalEvent,
  WorkspaceSession,
} from "../types";
import {
  getMessages,
  saveMessage,
  globalSearch,
} from "../services/storageService";
import { Toast } from "./Toast";

interface Props {
  user: UserType;
  loads: LoadData[];
  initialLoadId?: string | null;
  callSession?: CallSession | null;
  onClose?: () => void;
  interactionState?: "IDLE" | "ACTIVE" | "WRAP-UP";
  onNoteCreated?: (note: string) => void;
  onRecordAction?: (event: any) => Promise<void>;
  onLinkSession?: (
    sessionId: string,
    recordId: string,
    recordType: any,
  ) => Promise<void>;
  session: WorkspaceSession;
  unifiedEvents?: OperationalEvent[];
  threads?: any[];
}

export const OperationalMessaging: React.FC<Props> = ({
  user,
  loads,
  initialLoadId,
  onClose,
  callSession,
  interactionState = "IDLE",
  onNoteCreated,
  onRecordAction,
  onLinkSession,
  session,
  unifiedEvents = [],
  threads = [],
}) => {
  const activeContext = session.primaryContext;
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialLoadId ||
      (activeContext?.type === "LOAD"
        ? activeContext.id
        : activeContext?.type === "INCIDENT"
          ? `inc-${activeContext.id}`
          : null) ||
      threads[0]?.id ||
      loads[0]?.id ||
      null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [activeViewTab, setActiveViewTab] = useState<"MESSAGES" | "NOTES">(
    "MESSAGES",
  );
  const [showContext, setShowContext] = useState(true);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantResults, setParticipantResults] = useState<
    GlobalSearchResult[]
  >([]);
  const [isSearchingParticipants, setIsSearchingParticipants] = useState(false);
  const [tasks, setTasks] = useState<
    { id: string; text: string; completed: boolean }[]
  >([
    { id: "1", text: "Verify weight tickets", completed: false },
    { id: "2", text: "Confirm gate code", completed: true },
  ]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);

  const selectedLoad = useMemo(
    () =>
      loads.find(
        (l) => l.id === selectedThreadId || `inc-${l.id}` === selectedThreadId,
      ),
    [loads, selectedThreadId],
  );

  // Unified Messages State
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (initialLoadId) {
      setSelectedThreadId(initialLoadId);
    }
  }, [initialLoadId]);

  useEffect(() => {
    const fetchMessages = async () => {
      const msgs = await getMessages();
      setMessages(msgs);
    };
    fetchMessages();
  }, [selectedThreadId]);

  const filteredThreads = (threads.length > 0 ? threads : []).filter(
    (t) =>
      (t.primaryContext?.label || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (t.summary || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeMessages = messages.filter(
    (m) =>
      m.loadId === selectedThreadId || `inc-${m.loadId}` === selectedThreadId,
  );

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedThreadId) return;
    const draft: Message = {
      id: Math.random().toString(36).substr(2, 9),
      loadId: String(selectedThreadId).replace("inc-", ""),
      senderId: user.id,
      senderName: user.name,
      text: messageText,
      timestamp: new Date().toISOString(),
    };
    try {
      const saved = await saveMessage(draft);
      setMessages((prev) => [...prev, saved]);
      setMessageText("");
    } catch (err) {
      console.error("[OperationalMessaging] Message send failed:", err);
      setToast({
        message: "Message could not be delivered. Please try again.",
        type: "error",
      });
    }
  };

  useEffect(() => {
    const performParticipantSearch = async () => {
      if (participantSearch.length < 2) {
        setParticipantResults([]);
        return;
      }
      setIsSearchingParticipants(true);
      const results = await globalSearch(participantSearch);
      setParticipantResults(results);
      setIsSearchingParticipants(false);
    };
    const timer = setTimeout(performParticipantSearch, 300);
    return () => clearTimeout(timer);
  }, [participantSearch]);

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const handleAddParticipant = (res: GlobalSearchResult) => {
    setParticipantSearch("");
    setParticipantResults([]);
    if (onNoteCreated)
      onNoteCreated(
        `PARTICIPANT: Linked ${res.label} (${res.type}) to Liaison Stream.`,
      );
  };

  const handleCreateTask = async (text: string) => {
    if (!onRecordAction || !selectedThreadId) return;
    const targetId = String(selectedThreadId).replace("inc-", "");
    await onRecordAction({
      id: Math.random().toString(36).substr(2, 9),
      type: "TASK",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Strategic Task created: ${text}`,
      loadId: targetId,
      payload: { title: text, status: "PENDING" },
    });
    if (onNoteCreated)
      onNoteCreated(`ACTION: Created Strategic Task - ${text}`);
    setTasks((prev) => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), text, completed: false },
    ]);
  };

  const handleQuickRequest = async (type: string) => {
    if (!onRecordAction || !selectedThreadId) return;
    const targetId = String(selectedThreadId).replace("inc-", "");
    await onRecordAction({
      id: Math.random().toString(36).substr(2, 9),
      type: "REQUEST",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Created ${type} request via Liaison`,
      loadId: targetId,
      payload: { type, status: "NEW", amount: 0 },
    });
    if (onNoteCreated)
      onNoteCreated(`ACTION: Committing ${type} request to Ledger`);
  };

  return (
    <div className="flex h-full bg-[#020617] text-slate-100 overflow-hidden">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {/* Thread Sidebar */}
      <aside className="w-80 border-r border-white/5 flex flex-col shrink-0 bg-[#0a0f1e]/50">
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Operational Streams
            </h2>
            <button
              className="p-2 hover:bg-white/5 rounded-lg text-slate-500"
              title="Manage Threads"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-2">
            <p className="text-[8px] font-bold text-blue-400 uppercase leading-relaxed">
              These are record-linked liaison streams. For live inbound calls,
              use the <span className="underline">Live Comm Queue</span>.
            </p>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="text"
              placeholder="Find load/record stream..."
              className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-[11px] outline-none focus:border-blue-500/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setSelectedThreadId(thread.id)}
              className={`w-full p-6 text-left border-b border-white/5 transition-all flex items-start gap-4 ${selectedThreadId === thread.id ? "bg-blue-600/10 border-r-2 border-r-blue-500" : "hover:bg-white/[0.02]"}`}
            >
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
                {thread.id.startsWith("inc-") ? (
                  <AlertTriangle
                    className={`w-5 h-5 ${selectedThreadId === thread.id ? "text-red-500" : "text-slate-600"}`}
                  />
                ) : (
                  <Truck
                    className={`w-5 h-5 ${selectedThreadId === thread.id ? "text-blue-500" : "text-slate-600"}`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                    {thread.primaryContext?.label}
                  </span>
                  {selectedThreadId === thread.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-[8px] font-bold text-slate-500 uppercase truncate">
                  {thread.summary}
                </p>
                <div className="mt-2 text-[9px] text-slate-400 truncate opacity-60">
                  {messages.findLast(
                    (m) =>
                      m.loadId === thread.id || `inc-${m.loadId}` === thread.id,
                  )?.text || "No updates recently"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-slate-950/20">
        {selectedLoad ? (
          <>
            {/* Chat Header */}
            <header className="h-20 border-b border-white/5 flex items-center px-8 justify-between shrink-0 bg-slate-900/40">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-white tracking-tight">
                      {selectedLoad
                        ? `Load #${selectedLoad.loadNumber} Liaison`
                        : "Operational Messaging"}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${interactionState === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-slate-500"}`}
                      />
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                        {interactionState}{" "}
                        {callSession?.id ? `(${callSession.id})` : ""}
                      </span>
                      {interactionState === "ACTIVE" && (
                        <button
                          onClick={() =>
                            onNoteCreated?.("Interaction Ended via Liaison")
                          }
                          className="px-2 py-0.5 bg-red-600 text-white text-[7px] font-black uppercase rounded hover:bg-red-500 transition-colors ml-2"
                        >
                          End Session
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <nav className="flex items-center h-full ml-10 border-l border-white/5 pl-10 gap-8">
                  <button
                    onClick={() => setActiveViewTab("MESSAGES")}
                    className={`text-[9px] font-black uppercase tracking-widest transition-all ${activeViewTab === "MESSAGES" ? "text-blue-500 border-b-2 border-blue-500 pb-1" : "text-slate-500 hover:text-white"}`}
                  >
                    Tactical Stream
                  </button>
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowContext(!showContext)}
                  className={`p-2 rounded-lg transition-colors ${showContext ? "bg-blue-600/20 text-blue-400" : "text-slate-500 hover:bg-white/5"}`}
                >
                  <Info className="w-4 h-4" />
                </button>

                {interactionState === "ACTIVE" && (
                  <div className="flex items-center gap-1.5 ml-2 border-l border-white/5 pl-4">
                    <button className="px-3 py-1.5 bg-green-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-green-500 transition-all flex items-center gap-2">
                      <CheckSquare className="w-3 h-3" /> Resolve
                    </button>
                    <button className="px-3 py-1.5 bg-slate-800 text-slate-400 text-[9px] font-black uppercase rounded-lg hover:bg-slate-700 hover:text-white transition-all">
                      Snooze
                    </button>
                    <button className="px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-blue-500 transition-all">
                      Assign
                    </button>
                  </div>
                )}

                <button className="p-2 hover:bg-white/5 rounded-lg text-slate-500">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
              {/* Live Interaction Banner */}
              {interactionState === "ACTIVE" && (
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-3xl p-6 mb-8 animate-in slide-in-from-top duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
                          Live Voice Interaction
                        </h4>
                        <p className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter mt-0.5">
                          Session ID: {callSession?.id || "PENDING"}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 px-3 py-1 rounded-lg border border-white/10">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Active Partner:{" "}
                        {callSession?.participants?.[0]?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      className="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-4 text-xs text-white h-20 resize-none outline-none focus:border-blue-500/50 transition-all"
                      placeholder="Capture live tactical notes here..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (!noteText.trim()) return;
                        if (onNoteCreated) onNoteCreated(noteText);
                        setNoteText("");
                      }}
                      className="absolute bottom-3 right-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                    >
                      Commit Note
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center">
                <span className="bg-slate-900 border border-white/5 px-4 py-1.5 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest mb-8">
                  Tactical Evidence Stream
                </span>
              </div>

              {/* Unified Feed: Messages and Operational Events */}
              {[
                ...activeMessages.map((m) => ({ ...m, streamType: "MESSAGE" })),
                ...(unifiedEvents || [])
                  .filter(
                    (e) =>
                      e.loadId === selectedThreadId ||
                      (e.loadId && `inc-${e.loadId}` === selectedThreadId),
                  )
                  .map((e) => ({ ...e, streamType: "EVENT" })),
              ]
                .sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime(),
                )
                .map((item: any) => (
                  <div
                    key={item.id}
                    className={`flex flex-col ${item.streamType === "MESSAGE" && item.senderId === user.id ? "items-end" : "items-start"}`}
                  >
                    {item.streamType === "MESSAGE" ? (
                      <>
                        <div className="flex items-center gap-2 mb-1.5 px-2 text-[8px] font-black text-slate-500 uppercase">
                          <span>{item.senderName}</span>
                          <span>
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          className={`max-w-[70%] p-4 rounded-2xl text-[11px] font-medium leading-relaxed ${item.senderId === user.id ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "bg-slate-900/80 text-slate-300 border border-white/5"}`}
                        >
                          {item.text}
                        </div>
                      </>
                    ) : (
                      <div className="w-full flex items-center gap-4 py-2 opacity-80 group">
                        <div className="h-px flex-1 bg-white/5" />
                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/40 border border-white/5 rounded-full">
                          <div
                            className={`p-1.5 rounded-md ${item.type === "CALL_LOG" ? "bg-blue-500/10 text-blue-500" : "bg-slate-500/10 text-slate-500"}`}
                          >
                            {item.type === "CALL_LOG" ? (
                              <Phone className="w-3 h-3" />
                            ) : (
                              <Info className="w-3 h-3" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white uppercase tracking-tight">
                              {item.message}
                            </span>
                            <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">
                              {item.actorName} •{" "}
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Input Area (Messages Only) */}
            {activeViewTab === "MESSAGES" && (
              <div className="p-6 border-t border-white/5">
                <div className="bg-slate-950 border border-white/5 rounded-2xl p-2 flex items-end gap-2 shadow-inner">
                  <button className="p-3 text-slate-600 hover:text-slate-400 transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button className="p-3 text-slate-600 hover:text-slate-400 transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <textarea
                    className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-xs font-medium text-white placeholder:text-slate-700 resize-none min-h-[44px]"
                    placeholder={`Message participants for Load #${selectedLoad.loadNumber}...`}
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-800 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-950/20 backdrop-blur-sm">
            {interactionState === "ACTIVE" ? (
              <div className="bg-slate-900 border border-white/5 rounded-[3rem] p-12 max-w-md animate-in fade-in zoom-in duration-500 shadow-2xl">
                <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-blue-500/30">
                  <MessageSquare className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">
                  Unlinked Active Session
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8 leading-relaxed">
                  You have an active interaction ({callSession?.id}) without a
                  linked operational record. Search for a load or driver to
                  associate this session.
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="SEARCH LOAD OR DRIVER TO LINK..."
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-[10px] font-black uppercase text-white outline-none focus:border-blue-500/50"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                    />
                  </div>

                  {participantResults.length > 0 && (
                    <div className="bg-slate-950/80 border border-white/5 rounded-2xl overflow-hidden max-h-60 overflow-y-auto no-scrollbar shadow-2xl">
                      {participantResults.map((res) => (
                        <button
                          key={res.id}
                          onClick={() =>
                            onLinkSession?.(
                              callSession?.id ?? "",
                              res.id,
                              res.type as any,
                            )
                          }
                          className="w-full p-4 hover:bg-white/5 border-b border-white/5 flex items-center justify-between group transition-all"
                        >
                          <div className="flex flex-col text-left">
                            <span className="text-[11px] font-black text-white uppercase group-hover:text-blue-400">
                              {res.label}
                            </span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase">
                              {res.type} • {res.subLabel}
                            </span>
                          </div>
                          <div className="px-3 py-1 bg-blue-600/10 text-blue-500 text-[8px] font-black uppercase rounded opacity-0 group-hover:opacity-100">
                            Link Session
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] border-t border-white/5 pt-8 mt-8">
                  Protocol: Link Record to Proceed
                </div>
              </div>
            ) : (
              <div className="opacity-40 flex flex-col items-center">
                <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-8">
                  <MessageSquare className="w-12 h-12 text-slate-500" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
                  Omni-Channel Liaison
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest max-w-xs">
                  Select a communication thread from the left rail to initiate
                  tactical messaging.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Context Sidebar */}
      {showContext && selectedLoad && (
        <aside className="w-72 border-l border-white/5 flex flex-col shrink-0 bg-[#0a0f1e]/80 animate-in slide-in-from-right duration-200">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Resource Context
            </h2>
          </div>
          <div className="p-6 space-y-8 overflow-y-auto no-scrollbar">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-tighter">
                  Routing Geometry
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 rounded-2xl border border-white/5">
                  <div className="text-[8px] font-black text-slate-500 uppercase mb-1">
                    Pickup
                  </div>
                  <div className="text-[10px] font-bold text-white truncate">
                    {selectedLoad.pickup?.city ?? ""}
                  </div>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-white/5">
                  <div className="text-[8px] font-black text-slate-500 uppercase mb-1">
                    Dropoff
                  </div>
                  <div className="text-[10px] font-bold text-white truncate">
                    {selectedLoad.dropoff?.city ?? ""}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-tighter">
                  Temporal Data
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">
                    Pickup Date
                  </span>
                  <span className="text-white font-black">
                    {selectedLoad.pickupDate}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">
                    Status
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-black text-[8px] uppercase">
                    {selectedLoad.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-tighter">
                  Operational Tasks
                </div>
              </div>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-white/5 active:scale-95 transition-all cursor-pointer"
                    onClick={() => handleToggleTask(task.id)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${task.completed ? "bg-green-500 border-green-500" : "border-white/20"}`}
                    >
                      {task.completed && (
                        <CheckSquare className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-tight ${task.completed ? "text-slate-600 line-through" : "text-slate-300"}`}
                    >
                      {task.text}
                    </span>
                  </div>
                ))}
                {isAddingTask ? (
                  <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-blue-500/30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <input
                      autoFocus
                      className="w-full bg-transparent border-none outline-none text-[10px] text-white placeholder:text-slate-600 font-bold uppercase"
                      placeholder="Enter task objective..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (newTaskText.trim()) handleCreateTask(newTaskText);
                          setIsAddingTask(false);
                          setNewTaskText("");
                        }
                        if (e.key === "Escape") {
                          setIsAddingTask(false);
                          setNewTaskText("");
                        }
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[7px] font-black text-slate-600 uppercase">
                        Press Enter to Commit
                      </span>
                      <button
                        onClick={() => {
                          setIsAddingTask(false);
                          setNewTaskText("");
                        }}
                        className="text-[7px] font-black text-red-500 uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingTask(true)}
                    className="w-full py-2 bg-white/5 border border-dashed border-white/10 rounded-xl text-[8px] font-black text-slate-500 uppercase hover:text-blue-400 hover:border-blue-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <PlusSquare className="w-3 h-3" /> Add Micro-Task
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-tighter">
                  Quick Requests
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["DETENTION", "LAYOVER", "TOWING", "LUMPER"].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleQuickRequest(type)}
                    className="p-3 bg-slate-950 border border-white/5 rounded-xl text-[8px] font-black text-slate-400 uppercase hover:bg-blue-600/10 hover:text-blue-400 hover:border-blue-500/30 transition-all flex flex-col items-center gap-1 group"
                  >
                    <CreditCard className="w-3 h-3 group-hover:text-blue-400 transition-colors" />
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center">
                  <UsersIcon className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-tighter">
                  Participants
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <SearchIcon
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isSearchingParticipants ? "text-blue-500 animate-pulse" : "text-slate-600"}`}
                  />
                  <input
                    type="text"
                    placeholder="Add participant (360 search)..."
                    className="w-full bg-slate-950 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[9px] outline-none focus:border-blue-500/50 transition-all text-white"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                  />
                  {participantResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                      {participantResults.map((res) => (
                        <button
                          key={res.id}
                          onClick={() => handleAddParticipant(res)}
                          className="w-full p-3 text-left hover:bg-white/5 border-b border-white/5 flex items-center justify-between group"
                        >
                          <div>
                            <div className="text-[9px] font-black text-white uppercase">
                              {res.label}
                            </div>
                            <div className="text-[7px] font-bold text-slate-500 uppercase">
                              {res.type}{" "}
                              {res.subLabel ? `• ${res.subLabel}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {res.type === "DRIVER" && (
                              <Phone className="w-3 h-3 text-emerald-500" />
                            )}
                            <Link className="w-3 h-3 text-slate-700 group-hover:text-blue-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex -space-x-2">
                  <div
                    className="w-6 h-6 rounded-full bg-blue-600 border-2 border-[#10141d] flex items-center justify-center text-[8px] font-black text-white"
                    title={user.name}
                  >
                    {user.name.charAt(0)}
                  </div>
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#10141d] flex items-center justify-center text-[8px] font-black text-slate-500"
                    >
                      ?
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <button className="w-full flex items-center justify-between p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-lg shadow-blue-900/20 group">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Contact Dispatch
                </span>
                <Phone className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
