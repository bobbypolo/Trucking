export interface QueueItem {
  id: string;
  filePath: string;
  loadId: string;
  documentType: string;
  status: "pending" | "uploading" | "completed" | "failed";
  retryCount: number;
  createdAt: string;
}
