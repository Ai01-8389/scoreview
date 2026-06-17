const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

export async function postApi<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function putApi<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteApi<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'DELETE' });
}

export async function uploadImage<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}
