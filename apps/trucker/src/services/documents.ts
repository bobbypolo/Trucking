import api from "./api";

interface UploadDocumentParams {
  uri: string;
  loadId: string;
  documentType: string;
}

interface UploadResponse {
  id: string;
}

interface OcrField {
  field_name: string;
  extracted_value: string;
  confidence: number;
}

interface OcrResult {
  fields: OcrField[];
}

interface Document {
  id: string;
  document_type: string;
  filename: string;
  created_at: string;
  load_id: string | null;
}

// # Tests R-P5-01
export async function uploadDocument(
  params: UploadDocumentParams,
): Promise<UploadResponse> {
  const formData = new FormData();
  const fileObj = {
    uri: params.uri,
    type: "image/jpeg",
    name: "document.jpg",
  } as unknown as Blob;
  formData.append("file", fileObj);
  formData.append("load_id", params.loadId);
  formData.append("document_type", params.documentType);

  return api.uploadFile<UploadResponse>("/documents", formData);
}

export async function triggerOcr(documentId: string): Promise<OcrResult> {
  return api.post<OcrResult>(`/documents/${documentId}/process-ocr`);
}

export async function getOcrResult(documentId: string): Promise<OcrResult> {
  return api.get<OcrResult>(`/documents/${documentId}/ocr`);
}

export async function listDocuments(loadId: string): Promise<Document[]> {
  return api.get<Document[]>(`/documents?load_id=${loadId}`);
}
