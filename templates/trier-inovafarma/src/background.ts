import { eventBus } from '@/lib/event-bus';
import {
  ENSURE_PRODUCTS_SYNC_MESSAGE,
  FORCE_PRODUCTS_SYNC_MESSAGE,
  PRODUCTS_SYNC_STATUS_MESSAGE,
  PRODUCTS_UPDATED_MESSAGE,
  type SyncRuntimeEvent,
  type SyncRuntimeRequest,
  type SyncRuntimeResponse,
} from '@/lib/products-sync-runtime';
import { forceSync, getProducts } from '@/services/googleSheetsService';

const PERIODIC_SYNC_ALARM = 'products-periodic-sync';
const PERIODIC_SYNC_INTERVAL_MINUTES = 10;

function broadcastSyncEvent(message: SyncRuntimeEvent): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}

function ensurePeriodicSyncAlarm(): void {
  chrome.alarms.create(PERIODIC_SYNC_ALARM, {
    delayInMinutes: PERIODIC_SYNC_INTERVAL_MINUTES,
    periodInMinutes: PERIODIC_SYNC_INTERVAL_MINUTES,
  });
}

async function hasAuthenticatedSession(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['token'], (result) => {
      void chrome.runtime.lastError;
      resolve(Boolean(result.token));
    });
  });
}

async function runScheduledSync(reason: string): Promise<void> {
  const canSync = await hasAuthenticatedSession();
  if (!canSync) {
    return;
  }

  try {
    await getProducts();
  } catch (error) {
    console.error(`Falha no sync agendado (${reason}).`, error);
  }
}

async function handleSyncRequest(message: SyncRuntimeRequest): Promise<void> {
  if (message.type === FORCE_PRODUCTS_SYNC_MESSAGE) {
    await forceSync();
    return;
  }

  await getProducts();
}

eventBus.on('loading:status', (status: string) => {
  broadcastSyncEvent({
    type: PRODUCTS_SYNC_STATUS_MESSAGE,
    status,
  });
});

eventBus.on('products:updated', (total: number) => {
  broadcastSyncEvent({
    type: PRODUCTS_UPDATED_MESSAGE,
    total,
  });
});

chrome.runtime.onInstalled.addListener(() => {
  ensurePeriodicSyncAlarm();
  void runScheduledSync('install');
});

chrome.runtime.onStartup.addListener(() => {
  ensurePeriodicSyncAlarm();
  void runScheduledSync('startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== PERIODIC_SYNC_ALARM) {
    return;
  }

  void runScheduledSync('alarm');
});

chrome.runtime.onMessage.addListener((message: SyncRuntimeRequest, _sender, sendResponse) => {
  if (
    message.type !== ENSURE_PRODUCTS_SYNC_MESSAGE &&
    message.type !== FORCE_PRODUCTS_SYNC_MESSAGE
  ) {
    return false;
  }

  void handleSyncRequest(message)
    .then(() => {
      sendResponse({ ok: true } satisfies SyncRuntimeResponse);
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Falha ao sincronizar produtos.';
      sendResponse({
        ok: false,
        error: errorMessage,
      } satisfies SyncRuntimeResponse);
    });

  return true;
});

