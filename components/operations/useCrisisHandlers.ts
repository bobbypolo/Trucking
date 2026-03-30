import { v4 as uuidv4 } from "uuid";
import {
  OperationalEvent,
  OperationalTask,
  NotificationJob,
  ServiceTicket,
  CallSession,
  EntityType,
  LoadData,
  Contact,
} from "../../types";

/**
 * Dependencies injected from IntelligenceHub into the crisis handlers hook.
 * All state and service references come from the parent component.
 */
export interface CrisisHandlerDeps {
  user: { id: string; name: string };
  activeRecord: { id: string; type: EntityType; label: string } | null;
  active360Data: any;
  currentCallSession: CallSession | null;
  setCurrentCallSession: (s: CallSession | null) => void;
  allContacts: Contact[];
  selectedVendorForRoadside: any;
  roadsideNotes: string;
  selectedContacts: string[];
  notificationContacts: any[];
  notificationMessage: string;

  // UI state setters
  showSuccessMessage: (msg: string, duration?: number) => void;
  setToast: (
    toast: { message: string; type: "success" | "error" | "info" } | null,
  ) => void;
  setShowRoadsideForm: (v: boolean) => void;
  setShowNotifyPicker: (v: boolean) => void;
  setNotificationContacts: (contacts: any[]) => void;
  setActive360Data: (data: any) => void;
  showConfirmDialog: (title: string, message: string) => Promise<boolean>;

  // Logging/refresh
  onRecordAction: (e: OperationalEvent) => Promise<void>;
  handleActionLogging: (event: OperationalEvent) => Promise<void>;
  fetchQueues: () => Promise<void>;

  // Service functions
  getRecord360Data: (type: string, id: string) => Promise<any>;
  saveTask: (task: OperationalTask) => Promise<any>;
  saveIncident: (inc: any) => Promise<any>;
  saveIncidentCharge: (id: string, charge: any) => Promise<any>;
  saveCallSession: (session: CallSession) => Promise<any>;
  saveServiceTicket: (ticket: ServiceTicket) => Promise<any>;
  saveNotificationJob: (job: NotificationJob) => Promise<any>;
}

export function useCrisisHandlers(deps: CrisisHandlerDeps) {
  const {
    user,
    activeRecord,
    active360Data,
    currentCallSession,
    setCurrentCallSession,
    allContacts,
    selectedVendorForRoadside,
    roadsideNotes,
    selectedContacts,
    notificationContacts,
    notificationMessage,
    showSuccessMessage,
    setToast,
    setShowRoadsideForm,
    setShowNotifyPicker,
    setNotificationContacts,
    setActive360Data,
    showConfirmDialog,
    onRecordAction,
    handleActionLogging,
    fetchQueues,
    getRecord360Data,
    saveTask,
    saveIncident,
    saveIncidentCharge,
    saveCallSession,
    saveServiceTicket,
    saveNotificationJob,
  } = deps;

  const handleSafetyEscalate = async (load?: LoadData) => {
    if (!load && !activeRecord) {
      showSuccessMessage(
        "SYSTEM: Protocol requires an active record context for safety escalation.",
        3000,
      );
      return;
    }

    const targetLoadId =
      load?.id || (activeRecord?.type === "LOAD" ? activeRecord.id : undefined);

    const task: OperationalTask = {
      id: `TASK-${uuidv4().slice(0, 8).toUpperCase()}`,
      type: "GENERAL",
      title: `CRITICAL: Safety Handoff - Load #${load?.loadNumber || activeRecord?.label}`,
      description: `Manual safety escalation triggered by ${user.name}. Asset requires immediate compliance review or intervention.`,
      status: "OPEN",
      priority: "CRITICAL",
      assignedTo: "SAFETY_COMPLIANCE",
      dueDate: new Date(Date.now() + 900000).toISOString(), // 15 mins
      links: [
        {
          id: uuidv4(),
          entityType: "LOAD",
          entityId: targetLoadId,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          createdBy: user.name,
        },
      ],
      createdAt: new Date().toISOString(),
      createdBy: user.name,
    };
    await saveTask(task);
    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      loadId: targetLoadId,
      message: `Dispatcher ${user.name} escalated Load #${load?.loadNumber || activeRecord?.label} to Safety`,
      payload: { category: "Escalation", action: "Safety Handoff" },
    });
    showSuccessMessage(
      "SAFETY PROTOCOL TRIGGERED: Handoff Created for Safety & Compliance",
    );
    fetchQueues();
  };

  const handleAttachToRecord = async (
    item: any,
    type: EntityType | "PROVIDER" | "CONTACT",
  ) => {
    // 1. Priority: Link to active interaction if one exists
    if (currentCallSession) {
      await handleLinkSessionToRecord(
        currentCallSession.id,
        item.id,
        type as EntityType,
      );
      showSuccessMessage(
        `${type} ${item.name || item.label || item.id} linked to active call.`,
      );
      return;
    }

    // 2. Secondary: Attach to currently viewed record (Workspace)
    if (!activeRecord) {
      setToast({
        message: "No active record or call to attach to",
        type: "error",
      });
      return;
    }

    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      loadId: activeRecord.type === "LOAD" ? activeRecord.id : undefined,
      message: `${type} attached to ${activeRecord.type}: ${item.name || item.label || item.id}`,
      payload: {
        category: "Attachment",
        itemId: item.id,
        itemType: type,
        recordId: activeRecord.id,
        recordType: activeRecord.type,
      },
    });

    if (activeRecord.type === "INCIDENT" && active360Data?.incident) {
      const updated = {
        ...active360Data.incident,
        timeline: active360Data.incident.timeline ?? [],
      };
      updated.timeline.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        actorName: user.name,
        action: `${type}_ATTACHED`,
        notes: `${type} attached: ${item.name || item.label || item.id}`,
      });
      await saveIncident(updated);
      const data = await getRecord360Data(activeRecord.type, activeRecord.id);
      setActive360Data(data);
    }

    showSuccessMessage(
      `${item.name || item.label || item.id} attached to ${activeRecord.label}`,
    );
  };

  const handleLinkSessionToRecord = async (
    sessionId: string,
    recordId: string,
    recordType: EntityType,
  ) => {
    if (!currentCallSession || currentCallSession.id !== sessionId) return;

    const updatedSession = {
      ...currentCallSession,
      loadId: recordId,
      type: recordType,
    };
    await saveCallSession(updatedSession);
    setCurrentCallSession(updatedSession);

    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      loadId: recordId,
      message: `Interaction Session ${sessionId} linked to ${recordType} Record`,
      payload: { category: "Linking", sessionId, recordId, recordType },
    });

    showSuccessMessage(`Session Successfully Linked to Record`);
  };

  const handleNotifyPartners = async () => {
    // Fetch relevant contacts for the active load/incident
    let contacts = [];

    // 1. Contextual internal contacts
    if (active360Data?.load) {
      contacts.push({
        id: "c-driver",
        name: active360Data.driver?.name || "Driver",
        role: "Driver",
        phone: active360Data.driver?.phone || "",
      });
      contacts.push({
        id: "c-safety",
        name: "Safety Team",
        role: "Internal",
        phone: "",
      });
    }

    // 2. Supplement with Enterprise Directory contacts
    const directoryContacts = allContacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.type,
      phone: c.phone,
    }));

    contacts = [...contacts, ...directoryContacts];

    setNotificationContacts(contacts);
    setShowNotifyPicker(true);
  };

  const automatedStakeholderNotify = async (
    loadId: string,
    emails: string[],
    message: string,
  ) => {
    const jobId = `AUTO-JOB-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Log the system action
    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: "SYSTEM-AI",
      actorName: "Intelligence Engine",
      message: `AUTOMATED ALERT: Stakeholders notified for Load #${loadId}: ${message}`,
      payload: {
        category: "Communications",
        action: "AutoNotify",
        loadId,
        emails,
      },
    });

    // Mirror the notification job in storage for audit
    const job: NotificationJob = {
      id: jobId,
      loadId,
      recipients: emails.map((e) => ({
        id: e,
        name: e,
        role: "Stakeholder",
        phone: "",
      })),
      message: message,
      channel: "Email",
      status: "SENT",
      sentBy: "SYSTEM",
      sentAt: new Date().toISOString(),
    };
    await saveNotificationJob(job);
  };

  const sendNotificationJob = async () => {
    if (selectedContacts.length === 0) {
      showSuccessMessage(
        "PROTOCOL ERROR: Recipient selection required for broadcast.",
        3000,
      );
      return;
    }

    const jobId = `JOB-${uuidv4().slice(0, 8).toUpperCase()}`;
    const job: NotificationJob = {
      id: jobId,
      loadId: active360Data?.load?.id,
      incidentId:
        activeRecord!.type === "INCIDENT" ? activeRecord!.id : undefined,
      recipients: selectedContacts.map((cId) => {
        const contact = notificationContacts.find((nc: any) => nc.id === cId);
        return {
          id: cId,
          name: contact?.name || "Unknown",
          role: contact?.role || "Partner",
          phone: contact?.phone || "",
        };
      }),
      message: notificationMessage,
      channel: "Multi",
      status: "SENT",
      sentBy: user.id,
      sentAt: new Date().toISOString(),
    };

    await saveNotificationJob(job);

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Broadcasting emergency alerts to ${selectedContacts.length} partners via ${jobId}: ${notificationMessage}`,
      payload: {
        category: "Safety",
        action: "NotificationJob",
        jobId,
        recipients: selectedContacts,
        notes: notificationMessage,
        loadId: active360Data?.load?.id,
      },
    });

    if (activeRecord!.type === "INCIDENT") {
      const updated = { ...active360Data.incident };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "STAKEHOLDERS_NOTIFIED",
          notes: `Notified ${selectedContacts.length} partners via job ${jobId}. Message: ${notificationMessage}`,
        },
      ];
      await saveIncident(updated);
      await fetchQueues();
    }

    setShowNotifyPicker(false);
    showSuccessMessage("Stakeholders Notified via Multi-Channel Protocol");

    const data = await getRecord360Data(activeRecord!.type, activeRecord!.id);
    setActive360Data(data);
  };

  const handleRoadsideAssist = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    if (!loadId) return;

    // KCI Enhancement: Use Modal instead of prompt
    setShowRoadsideForm(true);
  };

  const submitRoadsideDispatch = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    if (!selectedVendorForRoadside || !loadId) {
      showSuccessMessage(
        "SYSTEM ERROR: Valid vendor selection required for roadside dispatch.",
        3000,
      );
      return;
    }

    const ticketId = `ST-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const ticket: ServiceTicket = {
      id: ticketId,
      unitId: active360Data?.load?.truckNumber || "UNKNOWN",
      type: "Breakdown",
      status: "Assigned",
      priority:
        activeRecord!.type === "INCIDENT"
          ? active360Data?.incident?.severity || "High"
          : "Medium",
      description:
        roadsideNotes ||
        (activeRecord!.type === "INCIDENT"
          ? active360Data?.incident?.description
          : "Roadside assistance requested"),
      estimatedCost: 0,
      assignedVendorId: selectedVendorForRoadside.id,
      eta: "TBD",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveServiceTicket(ticket);
    } catch (e) {
      setToast({
        message: `Failed to save service ticket: ${e instanceof Error ? e.message : "Unknown error"}`,
        type: "error",
      });
      return;
    }

    // Record Emergency Charge (Financial Audit)
    if (activeRecord!.type === "INCIDENT") {
      try {
        await saveIncidentCharge(activeRecord!.id, {
          category: "Tow",
          amount: 0,
          providerVendor: selectedVendorForRoadside.name,
          status: "Approved",
        });
      } catch (e) {
        console.warn(
          "Failed to record emergency charge:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    await handleActionLogging({
      id: uuidv4(),
      type: "TASK",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Dispatched ${selectedVendorForRoadside.name}: ${ticketId} for Unit ${ticket.unitId}`,
      payload: {
        category: "Safety",
        action: "RoadsideAssist",
        loadId,
        ticketId,
        vendor: selectedVendorForRoadside.name,
        notes: roadsideNotes,
      },
    });

    if (activeRecord!.type === "INCIDENT") {
      const updated = { ...active360Data.incident };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "ROADSIDE_DISPATCHED",
          notes: `Vendor ${selectedVendorForRoadside.name} dispatched for roadside assistance. Ref: ${ticketId}. Contact: ${selectedVendorForRoadside.contacts?.[0]?.phone || "N/A"}`,
        },
      ];
      await saveIncident(updated);
    }

    await fetchQueues();
    setShowRoadsideForm(false);
    showSuccessMessage(
      `Roadside Assistance Dispatched: ${selectedVendorForRoadside.name}`,
      4000,
    );

    const data = await getRecord360Data(activeRecord!.type, activeRecord!.id);
    setActive360Data(data);
  };

  const handleEscalate = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    showSuccessMessage("Escalating to Leadership...");

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `URGENT ESCALATION: ${activeRecord!.type} ${activeRecord!.id} escalated by ${user.name}`,
      loadId: typeof loadId === "string" ? loadId : undefined,
      payload: {
        category: "Workflow",
        action: "Escalate",
        priority: "CRITICAL",
      },
    });

    if (activeRecord!.type === "INCIDENT" && active360Data?.incident) {
      const updated = {
        ...active360Data.incident,
        severity: "Critical" as const,
      };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "INCIDENT_ESCALATED",
          notes: "Escalated to management via Command Center",
        },
      ];
      await saveIncident(updated);
      await fetchQueues();
      const fresh = await getRecord360Data(
        activeRecord!.type,
        activeRecord!.id,
      );
      setActive360Data(fresh);
    }
  };

  const handleFullLockdown = async () => {
    const confirmed = await showConfirmDialog(
      "Full Operational Lockdown",
      "CRITICAL: Initiating Full Operational Lockdown for this record. Confirm?",
    );
    if (!confirmed) return;

    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    showSuccessMessage("PROTOCOL: FULL LOCKDOWN INITIATED");

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `!!! LOCKDOWN !!! ${activeRecord!.type} ${activeRecord!.id} locked by security protocol`,
      loadId: typeof loadId === "string" ? loadId : undefined,
      payload: { category: "Security", action: "Lockdown", status: "LOCKED" },
    });

    if (activeRecord!.type === "INCIDENT" && active360Data?.incident) {
      const updated = {
        ...active360Data.incident,
        status: "Closed" as const,
      }; // Or some 'Locked' status if it existed
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "SECURITY_LOCKDOWN",
          notes: "Full operational lockdown triggered",
        },
      ];
      await saveIncident(updated);
      await fetchQueues();
      const fresh = await getRecord360Data(
        activeRecord!.type,
        activeRecord!.id,
      );
      setActive360Data(fresh);
    }
  };

  const handleVerifyTrailerDrop = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    if (!loadId) {
      showSuccessMessage("No related load found to verify drop");
      return;
    }

    await onRecordAction({
      id: uuidv4(),
      type: "EQUIPMENT_EVENT",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Trailer Drop Verified for Load ${activeRecord!.label}`,
      payload: { event: "TRAILER_DROP_VERIFIED", status: "COMPLETED", loadId },
    });

    if (activeRecord!.type === "INCIDENT" && active360Data?.incident) {
      const updated = { ...active360Data.incident };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "EQUIPMENT_VERIFIED",
          notes: `Trailer drop verified for linked Load ${loadId}`,
        },
      ];
      await saveIncident(updated);
    }

    showSuccessMessage("Trailer Drop Verified", 3000);
  };

  return {
    handleSafetyEscalate,
    handleAttachToRecord,
    handleLinkSessionToRecord,
    handleNotifyPartners,
    automatedStakeholderNotify,
    sendNotificationJob,
    handleRoadsideAssist,
    submitRoadsideDispatch,
    handleEscalate,
    handleFullLockdown,
    handleVerifyTrailerDrop,
  };
}
