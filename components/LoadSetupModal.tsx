import React, { useState, useEffect } from 'react';
import { Broker, User, FreightType, Contract } from '../types';
import { Building2, User as UserIcon, ArrowRight, X, PhoneCall, Settings, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getBrokers, getContracts } from '../services/brokerService';
import { getCompanyUsers, getCompany } from '../services/authService';
import { generateNextLoadNumber } from '../services/storageService';

interface Props {
  currentUser: User;
  preSelectedBrokerId?: string;
  onContinue: (brokerId: string, driverId: string, loadNumber?: string, callNotes?: string, overrideFreightType?: FreightType, intermodalData?: any) => void;
  onCancel: () => void;
}

export const LoadSetupModal: React.FC<Props> = ({ currentUser, preSelectedBrokerId, onContinue, onCancel }) => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const [selectedBrokerId, setSelectedBrokerId] = useState(preSelectedBrokerId || '');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isPhoneOrder, setIsPhoneOrder] = useState(false);
  const [callNotes, setCallNotes] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [currentUser]);

  const loadInitialData = async () => {
    const bList = await getBrokers();
    setBrokers(bList);
    const coUsers = await getCompanyUsers(currentUser.companyId);
    setUsers(coUsers);
  };

  useEffect(() => {
    if (selectedBrokerId) {
      getContracts(selectedBrokerId).then(setContracts);
    }
  }, [selectedBrokerId]);

  const handleContinue = (forcePhoneOrder: boolean = false) => {
    if (selectedDriverId && selectedBrokerId) {
      if (forcePhoneOrder || isPhoneOrder) {
        getCompany(currentUser.companyId).then(company => {
          const broker = brokers.find(b => b.id === selectedBrokerId);
          if (company && broker) {
            const newLoadNumber = generateNextLoadNumber(company, broker.name);
            onContinue(selectedBrokerId, selectedDriverId, newLoadNumber, callNotes);
          } else {
            onContinue(selectedBrokerId, selectedDriverId, undefined, callNotes);
          }
        });
      } else {
        onContinue(selectedBrokerId, selectedDriverId);
      }
    } else {
      alert("Please select both a broker and a driver.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a2235] rounded-2xl border border-slate-800 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Setup New Load</h2>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Broker Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400">Select Broker / Customer</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <div className={`w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold flex justify-between items-center ${preSelectedBrokerId ? 'text-slate-200' : 'text-slate-400'}`}>
                {brokers.find(b => b.id === selectedBrokerId)?.name || 'Select Broker'}
                {preSelectedBrokerId && <span className="text-[10px] text-blue-500">(Locked)</span>}
              </div>
            </div>
          </div>

          {/* Driver Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400">Assign Driver</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-bold appearance-none focus:border-blue-500 outline-none"
            >
              <option value="">Select Carrier / Driver</option>
              {users.filter(u => u.role === 'driver' || u.role === 'owner_operator').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Phone Order Notes */}
          {isPhoneOrder && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Initial Call Notes</label>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="e.g. Appointment required for pickup, strict delivery window..."
                className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-4 text-xs text-white h-24 focus:border-blue-500 outline-none placeholder:text-slate-700"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => handleContinue(false)}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              Scan Doc <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => isPhoneOrder ? handleContinue(true) : setIsPhoneOrder(true)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
            >
              <PhoneCall className="w-4 h-4" /> {isPhoneOrder ? 'Create Order' : 'Phone Order'}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 italic text-center">
            "Phone Order" will auto-generate the next Load # based on company settings.
          </p>
        </div>
      </div>
    </div>
  );
};
