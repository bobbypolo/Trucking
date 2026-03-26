/**
 * TelematicsSetup — Stub for Team 1 shell wiring.
 *
 * The full implementation lives in Team 3's branch (team03/tracking-map-implementation).
 * This stub ensures the shell route compiles and renders a placeholder until integration.
 * Team 3's version will replace this file during the Phase 3 controlled integration window.
 */
import React from "react";
import { Settings } from "lucide-react";

export default function TelematicsSetup(): React.ReactElement {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Telematics Setup</h1>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800">
          GPS provider configuration and vehicle mapping will be available after
          Team 3 integration. This route is wired and ready for the full
          component.
        </p>
      </div>
    </div>
  );
}
