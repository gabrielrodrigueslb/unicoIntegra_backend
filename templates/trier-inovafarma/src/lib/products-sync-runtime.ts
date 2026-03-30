import { forceSync, getProducts } from '@/services/googleSheetsService';

export const ENSURE_PRODUCTS_SYNC_MESSAGE = 'products:ensure-sync';
export const FORCE_PRODUCTS_SYNC_MESSAGE = 'products:force-sync';
export const PRODUCTS_UPDATED_MESSAGE = 'products:updated';
export const PRODUCTS_SYNC_STATUS_MESSAGE = 'products:sync-status';

export interface SyncRuntimeRequest {
  type: typeof ENSURE_PRODUCTS_SYNC_MESSAGE | typeof FORCE_PRODUCTS_SYNC_MESSAGE;
}

export interface SyncRuntimeResponse {
  ok: boolean;
  error?: string;
}

export interface ProductsUpdatedRuntimeMessage {
  type: typeof PRODUCTS_UPDATED_MESSAGE;
  total: number;
}

export interface ProductsSyncStatusRuntimeMessage {
  type: typeof PRODUCTS_SYNC_STATUS_MESSAGE;
  status: string;
}

export type SyncRuntimeEvent =
  | ProductsUpdatedRuntimeMessage
  | ProductsSyncStatusRuntimeMessage;

function hasExtensionRuntimeMessaging(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id && chrome.runtime.sendMessage);
}

function sendSyncRuntimeRequest(message: SyncRuntimeRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response?: SyncRuntimeResponse) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Falha ao sincronizar produtos.'));
        return;
      }

      resolve();
    });
  });
}

export async function ensureProductsReady(): Promise<void> {
  if (hasExtensionRuntimeMessaging()) {
    try {
      await sendSyncRuntimeRequest({ type: ENSURE_PRODUCTS_SYNC_MESSAGE });
      return;
    } catch (error) {
      console.warn('Background sync indisponivel. Executando sincronizacao no popup.', error);
    }
  }

  await getProducts();
}

export async function forceProductsSyncNow(): Promise<void> {
  if (hasExtensionRuntimeMessaging()) {
    try {
      await sendSyncRuntimeRequest({ type: FORCE_PRODUCTS_SYNC_MESSAGE });
      return;
    } catch (error) {
      console.warn('Sync forçado no background indisponivel. Executando no popup.', error);
    }
  }

  await forceSync();
}

