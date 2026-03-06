import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { IFTAStateEntry } from '../types';

interface Props {
  data: IFTAStateEntry[];
}

export const IFTAChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-sm italic">No IFTA data available.</div>;
  }

  return (
    <div className="h-64 w-full bg-slate-800 p-4 rounded-lg border border-slate-700">
      <h3 className="text-slate-300 mb-2 font-semibold text-sm">Estimated Mileage per Jurisdiction</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="state" type="category" width={40} tick={{ fill: '#94a3b8' }} />
          <Tooltip 
            cursor={{fill: 'transparent'}}
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
          />
          <Bar dataKey="estimatedMiles" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#3b82f6" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
