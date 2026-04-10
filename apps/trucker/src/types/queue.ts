// # Tests R-P8-05
export type QueueItemStatus = "pending" | "uploading" | "completed" | "failed";

export interface QueueItem {
  id: string;
  filePath: string;
  loadId: string;
  documentType: string;
  status: QueueItemStatus;
  retryCount: number;
  createdAt: string;
}
