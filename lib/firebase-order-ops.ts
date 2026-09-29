const FIREBASE_DB_URL = "https://membership-7aef2-default-rtdb.firebaseio.com";
const ROOT = "order-ops";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${FIREBASE_DB_URL}/${ROOT}/${path}.json`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Firebase 요청에 실패했습니다.");
  return data;
}

export async function listOrderJobs() {
  const data = (await request("jobs")) as Record<string, any> | null;
  return Object.entries(data ?? {})
    .map(([id, job]) => ({ ...job, id }))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function getOrderJob(id: string) {
  const data = await request(`jobs/${encodeURIComponent(id)}`);
  return data ? { ...data, id } : null;
}

export async function createOrderJob(job: Record<string, unknown>) {
  const created = await request("jobs", { method: "POST", body: JSON.stringify(job) });
  const id = String(created?.name ?? Date.now());
  if (!created?.name) await request(`jobs/${id}`, { method: "PUT", body: JSON.stringify(job) });
  return { ...job, id };
}

export async function updateOrderJob(id: string, patch: Record<string, unknown>) {
  await request(`jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  return getOrderJob(id);
}
