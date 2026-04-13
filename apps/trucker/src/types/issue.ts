/**
 * Driver exception/issue types for the mobile issue reporting flow.
 *
 * Tests R-P7-01, R-P7-03
 */

export type IssueType =
  | "Breakdown"
  | "Delay"
  | "Detention"
  | "Lumper"
  | "Other";

export const ISSUE_TYPES: IssueType[] = [
  "Breakdown",
  "Delay",
  "Detention",
  "Lumper",
  "Other",
];

export interface CreateIssuePayload {
  issue_type: IssueType;
  load_id: string;
  description: string;
  photo_urls?: string[];
}

export interface DriverException {
  id: string;
  issue_type: IssueType;
  load_id: string;
  description: string;
  photo_urls: string[];
  status: string;
  created_at: string;
}
