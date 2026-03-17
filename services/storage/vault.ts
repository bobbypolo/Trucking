/**
 * Vault Documents domain — localStorage CRUD + Firebase Storage upload.
 * Owner: STORY-018/026 (Phase 2 migration to server).
 */
import { VaultDoc, VaultDocType, VaultDocStatus } from "../../types";
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { getTenantKey } from "./core";

export const STORAGE_KEY_VAULT_DOCS = (): string =>
  getTenantKey("vault_docs_v1");

export const getRawVaultDocs = (): VaultDoc[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_VAULT_DOCS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveVaultDoc = async (doc: VaultDoc) => {
  const docs = getRawVaultDocs();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx >= 0) docs[idx] = doc;
  else docs.unshift(doc);
  localStorage.setItem(STORAGE_KEY_VAULT_DOCS(), JSON.stringify(docs));
  return doc;
};

export const uploadVaultDoc = async (
  file: File,
  docType: VaultDocType,
  tenantId: string,
  metadata: any = {},
): Promise<VaultDoc> => {
  const id = uuidv4();
  const filename = `${id}_${file.name}`;
  const storageRef = ref(
    storage,
    `tenants/${tenantId}/docs/${docType}/${filename}`,
  );

  // Upload to Firebase Storage
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const doc: VaultDoc = {
    id,
    tenantId,
    type: docType,
    url,
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    status: "Submitted",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...metadata,
  };

  return await saveVaultDoc(doc);
};
