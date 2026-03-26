import React from "react";
import { LoadData, User, Broker } from "../types";

// Dashboard responsibilities moved to Operations Center (IntelligenceHub)

interface Props {
  user?: User;
  loads?: LoadData[];
  brokers?: Broker[];
  onViewLoad?: (load: LoadData) => void;
  onNavigate?: (tab: string, subTab?: string) => void;
  users?: User[];
  onOpenIssues?: () => void;
}

export const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold mb-4">Operations Dashboard</h2>
      <p className="text-gray-600 mb-4">
        The operations dashboard has been consolidated into Operations Center.
      </p>
      <button
        onClick={() => onNavigate?.("operations-hub")}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Go to Operations Center
      </button>
    </div>
  );
};
