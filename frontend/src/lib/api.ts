import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export function useProject() {
  const params = useParams();
  const routeProjectId = params.projectId;
  
  const [projectId, setProjectId] = useState<string>(
    routeProjectId || localStorage.getItem('atherops_project_id') || ''
  );

  useEffect(() => {
    if (routeProjectId && routeProjectId !== projectId) {
      setProjectId(routeProjectId);
    }
  }, [routeProjectId, projectId]);

  useEffect(() => {
    localStorage.setItem('atherops_project_id', projectId);
  }, [projectId]);

  return { projectId, setProjectId };
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(`API Error: ${res.status}`);
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error: ${res.status}`);
  }

  const json = await res.json();
  return json.data as T;
}

/** Like fetchApi but also returns the `meta` envelope field */
export async function fetchApiWithMeta<T>(endpoint: string, options?: RequestInit): Promise<{ data: T; meta?: any }> {
  const res = await fetch(`/api/v1${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(`API Error: ${res.status}`);
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error: ${res.status}`);
  }

  const json = await res.json();
  return { data: json.data as T, meta: json.meta };
}


export function useApi<T>(endpoint: string, options?: RequestInit & { deps?: any[] }) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchApi<T>(endpoint, options)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, options?.deps || [endpoint]);

  return { data, loading, error };
}
