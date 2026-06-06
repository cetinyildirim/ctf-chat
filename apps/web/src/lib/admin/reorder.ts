import { categoriesApi, channelsApi } from '@/lib/api/endpoints';

const REORDER_SAFE_TEMP = 9_887_766;

export async function swapCategoryPositions(
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  await categoriesApi.update(a.id, { position: REORDER_SAFE_TEMP });
  await categoriesApi.update(b.id, { position: a.position });
  await categoriesApi.update(a.id, { position: b.position });
}

export async function swapChannelPositions(
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  await channelsApi.update(a.id, { position: REORDER_SAFE_TEMP });
  await channelsApi.update(b.id, { position: a.position });
  await channelsApi.update(a.id, { position: b.position });
}
