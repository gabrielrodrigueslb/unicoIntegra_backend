import { openDB, type IDBPDatabase } from 'idb';
import type { ProductInfo } from '@/services/googleSheetsService';

const DB_NAME = 'product-database';
const STORE_NAME = 'products';
const META_STORE_NAME = 'sync-metadata';
const DB_VERSION = 2;

interface MetadataEntry<T = unknown> {
  key: string;
  value: T;
}

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'codigo' });
      }

      if (oldVersion < 2 && !db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME, { keyPath: 'key' });
      }
    },
  });
}

export async function isCacheEmpty(): Promise<boolean> {
  const db = await initDB();
  const count = await db.count(STORE_NAME);
  return count === 0;
}

export async function saveProductsToCache(products: ProductInfo[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  await tx.store.clear();
  await Promise.all(products.map((product) => tx.store.put(product)));
  await tx.done;
}

export async function upsertProductsToCache(
  products: ProductInfo[],
): Promise<void> {
  if (!products.length) return;

  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(products.map((product) => tx.store.put(product)));
  await tx.done;
}

export async function removeProductsFromCache(codes: number[]): Promise<void> {
  if (!codes.length) return;

  const uniqueCodes = [...new Set(codes)];
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(uniqueCodes.map((code) => tx.store.delete(code)));
  await tx.done;
}

export async function getProductsFromCache(): Promise<ProductInfo[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function getProductsByCodesFromCache(
  codes: number[],
): Promise<ProductInfo[]> {
  const uniqueCodes = [...new Set(codes)];
  if (!uniqueCodes.length) return [];

  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const products = await Promise.all(uniqueCodes.map((code) => tx.store.get(code)));
  await tx.done;

  return products.filter((product): product is ProductInfo => Boolean(product));
}

export async function setCacheMetadata<T>(
  key: string,
  value: T,
): Promise<void> {
  const db = await initDB();
  await db.put(META_STORE_NAME, { key, value } satisfies MetadataEntry<T>);
}

export async function getCacheMetadata<T>(key: string): Promise<T | null> {
  const db = await initDB();
  const data = (await db.get(META_STORE_NAME, key)) as MetadataEntry<T> | undefined;
  return data?.value ?? null;
}

export async function deleteCacheMetadata(key: string): Promise<void> {
  const db = await initDB();
  await db.delete(META_STORE_NAME, key);
}
