
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LoadData, User } from '../types';
import { ChevronLeft, ChevronRight, MapPin, Users, CheckSquare, Square, GripVertical, Calendar as CalendarIcon, X, Search, ChevronDown } from 'lucide-react';

interface Props {
  loads: LoadData[];
  onEdit: (load: LoadData) => void;
  users?: User[]; // List of company users for admin filter
  selectedDriverId?: string | null;
  onSelectDriver?: (id: string | null) => void;
  onMoveLoad?: (loadId: string, newDate: string) => void; // New prop for Drag & Drop support
}

// Helper
const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

interface DayCellProps {
  date: Date;
  loads: LoadData[];
  onEdit: (load: LoadData) => void;
  onMoveLoad?: (loadId: string, newDate: string) => void;
  draggedLoadId: string | null;
  onDragStart: (e: React.DragEvent, loadId: string) => void;
  onDrop: (e: React.DragEvent, dateKey: string) => void;
}

const DayCell: React.FC<DayCellProps> = ({ date, loads, onEdit, onMoveLoad, draggedLoadId, onDragStart, onDrop }) => {
    const dateKey = formatDateKey(date);
    const isToday = dateKey === formatDateKey(new Date());

    return (
        <div 
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => onDrop(e, dateKey)}
            className={`
            min-h-[120px] border-r border-b border-slate-700/50 p-2 flex flex-col gap-1 relative group transition-colors
            ${isToday ? 'bg-slate-800/80' : 'bg-slate-900'}
            hover:bg-slate-800/50
            `}
        >
            <div className={`flex justify-between items-center mb-1 ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                <span className={`text-sm font-bold ${isToday ? 'bg-blue-900/50 px-2 py-0.5 rounded-full border border-blue-500/30' : ''}`}>
                    {date.getDate()}
                </span>
                {onMoveLoad && loads.length === 0 && <div className="hidden group-hover:block text-[10px] text-slate-600">Drop</div>}
            </div>
            
            <div className="flex-1 flex flex-col gap-1.5">
                {loads.map(load => (
                    <div
                    key={load.id}
                    draggable={!!onMoveLoad}
                    onDragStart={(e) => onDragStart(e, load.id)}
                    onClick={(e) => { e.stopPropagation(); onEdit(load); }}
                    className={`
                        cursor-move select-none text-[10px] p-1.5 rounded border shadow-sm transition-transform hover:scale-[1.02]
                        flex items-start gap-1 relative overflow-hidden group/card
                        ${load.status === 'Delivered' ? 'bg-green-900/20 border-green-800/50 text-green-200' : 
                        load.status === 'Invoiced' ? 'bg-purple-900/20 border-purple-800/50 text-purple-200' : 
                        'bg-blue-900/20 border-blue-800/50 text-blue-200'}
                        ${draggedLoadId === load.id ? 'opacity-50' : 'opacity-100'}
                    `}
                    >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                            load.status === 'Delivered' ? 'bg-green-500' : load.status === 'Invoiced' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}></div>
                        <div className="flex-1 min-w-0 ml-1">
                            <div className="font-bold truncate flex justify-between">
                                <span>#{load.loadNumber}</span>
                            </div>
                            <div className="truncate opacity-80 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 shrink-0" /> {load.dropoff.city}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface MonthSectionProps {
  monthDate: Date;
  visibleLoads: LoadData[];
  onRegisterRef: (key: string, el: HTMLDivElement | null) => void;
  onEdit: (load: LoadData) => void;
  onMoveLoad?: (loadId: string, newDate: string) => void;
  draggedLoadId: string | null;
  onDragStart: (e: React.DragEvent, loadId: string) => void;
  onDrop: (e: React.DragEvent, dateKey: string) => void;
}

const MonthSection: React.FC<MonthSectionProps> = ({ monthDate, visibleLoads, onRegisterRef, ...props }) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthLabel = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const blanks = Array(firstDayOfWeek).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

    return (
        <div ref={el => onRegisterRef(`${year}-${month}`, el)} className="mb-8 scroll-mt-20">
            <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-y border-slate-700 py-3 px-4 shadow-md flex justify-between items-center">
                <h3 className="text-lg font-bold text-white tracking-tight">{monthLabel}</h3>
            </div>
            <div className="grid grid-cols-7 border-l border-slate-700">
                {/* Days Header */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-[10px] uppercase font-bold text-slate-600 bg-slate-950/30 py-1 border-r border-b border-slate-700/50">
                        {day}
                    </div>
                ))}
                {/* Blanks */}
                {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="bg-slate-950/30 border-r border-b border-slate-700/30 min-h-[120px]"></div>
                ))}
                {/* Days */}
                {days.map(date => (
                    <DayCell 
                        key={date.toISOString()} 
                        date={date} 
                        loads={visibleLoads.filter(l => l.pickupDate === formatDateKey(date))}
                        {...props}
                    />
                ))}
            </div>
        </div>
    );
};

export const CalendarView: React.FC<Props> = ({ loads, onEdit, users = [], selectedDriverId, onSelectDriver, onMoveLoad }) => {
  // Center around today initially
  const [baseDate, setBaseDate] = useState(new Date()); 
  const [draggedLoadId, setDraggedLoadId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Refs for scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<{[key: string]: HTMLDivElement | null}>({});

  // Date Picker State
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [manualDateInput, setManualDateInput] = useState('');

  // Filter loads based on selection
  const visibleLoads = useMemo(() => {
    if (!selectedDriverId) return loads;
    return loads.filter(l => l.driverId === selectedDriverId);
  }, [loads, selectedDriverId]);

  // Generate a list of months to render (e.g., 6 months back, 18 months forward)
  const monthsToRender = useMemo(() => {
    const months: Date[] = [];
    // Start 6 months back from the baseDate
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth() - 6, 1);
    // Render 2 years worth of months
    for (let i = 0; i < 24; i++) {
      months.push(new Date(start.getFullYear(), start.getMonth() + i, 1));
    }
    return months;
  }, [baseDate]); 

  // Helper to scroll to specific month
  const scrollToMonth = (date: Date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const el = monthRefs.current[key];
    if (el && containerRef.current) {
      containerRef.current.scrollTo({
        top: el.offsetTop - containerRef.current.offsetTop, 
        behavior: 'smooth'
      });
    }
  };

  // Scroll to "Today" on mount
  useEffect(() => {
    setTimeout(() => {
        const today = new Date();
        scrollToMonth(today);
    }, 100);
  }, []);

  const handleJumpToDate = (date: Date) => {
      setBaseDate(date); // Re-centers the list around this date
      setPickerYear(date.getFullYear());
      setShowDatePicker(false);
      // Wait for render then scroll
      setTimeout(() => scrollToMonth(date), 100);
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, loadId: string) => {
    setDraggedLoadId(loadId);
    e.dataTransfer.setData('text/plain', loadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const loadId = e.dataTransfer.getData('text/plain');
    if (loadId && onMoveLoad) {
        onMoveLoad(loadId, dateStr);
    }
    setDraggedLoadId(null);
  };

  return (
    <div className="flex h-full gap-4 relative">
        {/* Date Picker Modal */}
        {showDatePicker && (
            <div className="absolute top-16 left-4 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 w-80 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-blue-400" /> Jump to Date</h3>
                    <button onClick={() => setShowDatePicker(false)}><X className="w-4 h-4 text-slate-400 hover:text-white"/></button>
                </div>
                
                {/* Manual Input */}
                <div className="mb-4 bg-slate-900/50 p-2 rounded border border-slate-700">
                    <label className="text-[10px] text-slate-400 mb-1 block uppercase font-bold">Type Specific Date</label>
                    <div className="flex gap-2">
                        <input 
                            type="date" 
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm w-full focus:border-blue-500 outline-none"
                            value={manualDateInput}
                            onChange={(e) => setManualDateInput(e.target.value)}
                        />
                        <button 
                            onClick={() => { if(manualDateInput) handleJumpToDate(new Date(manualDateInput)); }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold"
                        >
                            Go
                        </button>
                    </div>
                </div>

                <div className="h-px bg-slate-700 my-4"></div>

                {/* Year Selector */}
                <div className="mb-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-2 block">Select Year</span>
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                        {Array.from({length: 12}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                            <button 
                                key={y} 
                                onClick={() => setPickerYear(y)}
                                className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap border transition-colors ${pickerYear === y ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500'}`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Month Grid */}
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({length: 12}, (_, i) => new Date(0, i).toLocaleString('default', {month: 'short'})).map((m, idx) => (
                        <button 
                            key={m}
                            onClick={() => handleJumpToDate(new Date(pickerYear, idx, 1))}
                            className={`py-2 text-xs font-medium rounded transition-colors ${pickerMonth === idx ? 'bg-slate-600 text-blue-300 border border-slate-500' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                
                <button 
                    onClick={() => handleJumpToDate(new Date())}
                    className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded border border-slate-600"
                >
                    Reset to Today
                </button>
            </div>
        )}

      {/* Driver Filter Sidebar */}
      {users.length > 0 && onSelectDriver && (
        <div className="hidden md:flex w-64 bg-slate-800 rounded-xl border border-slate-700 flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-900/50">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Drivers
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => onSelectDriver(null)}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors
                ${selectedDriverId === null ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}
              `}
            >
              {selectedDriverId === null ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              All Company Loads
            </button>
            <div className="h-px bg-slate-700 my-2 mx-2"></div>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => onSelectDriver(u.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors
                  ${selectedDriverId === u.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}
                `}
              >
                <div className={`w-2 h-2 rounded-full ${selectedDriverId === u.id ? 'bg-white' : 'bg-slate-500'}`}></div>
                <span className="truncate">{u.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col bg-slate-900 h-full rounded-xl border border-slate-700 overflow-hidden shadow-2xl relative">
        
        {/* Header Toolbar */}
        <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 shrink-0 z-30">
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors text-white font-bold shadow-sm"
                >
                    <CalendarIcon className="w-4 h-4 text-blue-400" />
                    {baseDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
                <button 
                    onClick={() => handleJumpToDate(new Date())} 
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white border border-slate-600 transition-colors"
                >
                    Today
                </button>
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
               Scroll for more months
            </div>
        </div>

        {/* Scrollable Container */}
        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-900 scroll-smooth">
            {monthsToRender.map(date => (
                <MonthSection 
                    key={date.toISOString()} 
                    monthDate={date} 
                    visibleLoads={visibleLoads}
                    onRegisterRef={(key, el) => monthRefs.current[key] = el}
                    onEdit={onEdit}
                    onMoveLoad={onMoveLoad}
                    draggedLoadId={draggedLoadId}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                />
            ))}
            
            <div className="py-12 text-center text-slate-500 text-sm border-t border-slate-800 mt-4">
                <p>End of 2-year calendar view.</p>
                <p className="text-xs mt-1">Use the Date Picker (top left) to jump to a different year.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
