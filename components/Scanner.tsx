
import React, { useState } from 'react';
import { Camera, Upload, Loader2, FileText, FolderOpen, Truck, BookOpen } from 'lucide-react';
import { extractLoadInfo, extractBrokerFromImage, extractEquipmentFromImage, generateTrainingFromImage } from '../services/geminiService';
import { LoadData } from '../types';

interface Props {
  onDataExtracted: (data: any, secondaryData?: any) => void;
  onCancel: () => void;
  mode?: 'load' | 'broker' | 'equipment' | 'training';
}

export const Scanner: React.FC<Props> = ({ onDataExtracted, onCancel, mode = 'load' }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError("Please select a valid file (JPG, PNG, PDF).");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        
        if (mode === 'broker') {
           const broker = await extractBrokerFromImage(base64String, file.type);
           onDataExtracted(broker);
        } else if (mode === 'equipment') {
           const equipment = await extractEquipmentFromImage(base64String, file.type);
           onDataExtracted(equipment);
        } else if (mode === 'training') {
           const quiz = await generateTrainingFromImage(base64String, file.type);
           onDataExtracted(quiz);
        } else {
           const { load, broker } = await extractLoadInfo(base64String, file.type);
           onDataExtracted(load, broker);
        }
      } catch (err: any) {
        console.error(err);
        const errorMessage = err?.message || 'Unknown error occurred';
        setError(`Scanning Failed: ${errorMessage}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const getTitle = () => {
      if (mode === 'broker') return 'Scan Broker Profile';
      if (mode === 'equipment') return 'Scan Equipment ID';
      if (mode === 'training') return 'Harvest Training Content';
      return 'Scan Load Document';
  };

  const getDescription = () => {
      if (mode === 'broker') return 'Upload a Carrier Packet or Rate Con to create a profile.';
      if (mode === 'equipment') return 'Take a photo of the Unit ID decal.';
      if (mode === 'training') return 'Upload safety manuals or technical bulletins to auto-generate quizzes.';
      return 'Upload or take a photo of a Rate Confirmation or BOL.';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full">
      {isProcessing ? (
        <div className="flex flex-col items-center py-10">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
          <h3 className="text-xl text-white font-semibold animate-pulse">AI Lab Analyzing</h3>
          <p className="text-slate-400 text-center mt-2 max-w-xs text-xs uppercase font-bold tracking-widest">
            {mode === 'training' ? 'Converting documentation to training modules...' : 'Extracting metadata...'}
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">
            {mode === 'training' ? <BookOpen className="w-8 h-8 text-blue-400" /> : mode === 'equipment' ? <Truck className="w-8 h-8 text-blue-400" /> : <FileText className="w-8 h-8 text-blue-400" />}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center uppercase tracking-tighter">{getTitle()}</h2>
          <p className="text-slate-400 text-center mb-8 max-w-sm text-sm font-medium">{getDescription()}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-6">
            <label className="relative cursor-pointer group">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-blue-500 text-white p-6 rounded-xl transition-all active:scale-95">
                <Camera className="w-8 h-8 text-blue-400" />
                <span className="font-bold uppercase text-xs tracking-widest">Take Photo</span>
              </div>
            </label>
            <label className="relative cursor-pointer group">
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-green-500 text-white p-6 rounded-xl transition-all active:scale-95">
                <FolderOpen className="w-8 h-8 text-green-400" />
                <span className="font-bold uppercase text-xs tracking-widest">Upload PDF/JPG</span>
              </div>
            </label>
          </div>
          {error && <div className="mb-6 p-4 bg-red-900/40 border border-red-800 text-red-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-3 w-full"><div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />{error}</div>}
          <div className="w-full border-t border-slate-700 pt-6 flex justify-center">
            <button onClick={onCancel} className="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded hover:bg-slate-700 transition-colors">Cancel Operation</button>
          </div>
        </div>
      )}
    </div>
  );
};
