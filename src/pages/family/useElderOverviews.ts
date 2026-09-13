import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { familyApi, type ElderOverview } from '@/lib/api';

/**
 * 家属端数据 hook：
 * 1. 拉取当前家属已绑定的老人列表
 * 2. 并发拉取每位老人的真实数据（资料/今日用药/药品/健康记录）
 *
 * 性能优化：模块级 60 秒缓存 —— 首页 / 用药 / 健康三个页面共用本 hook，
 * 短时间内切换页面不再重复请求后端；reload() 可强制刷新。
 */
const CACHE_TTL = 60_000; // 60 秒
const cache = new Map<string, { data: ElderOverview[]; ts: number }>();

async function fetchElders() {
  const members = await familyApi.listMembers();
  return Promise.all(members.map((m) => familyApi.elderOverview(m.id)));
}

function isFresh(key: string) {
  const hit = cache.get(key);
  return hit && Date.now() - hit.ts < CACHE_TTL;
}

export function useElderOverviews() {
  const { user } = useApp();
  const cacheKey = user ? `u${user.id}` : 'anon';
  const [elders, setElders] = useState<ElderOverview[]>(() =>
    isFresh(cacheKey) ? cache.get(cacheKey)!.data : [],
  );
  const [loading, setLoading] = useState<boolean>(() => !isFresh(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isFresh(cacheKey)) {
          setElders(cache.get(cacheKey)!.data);
          setLoading(false);
          return;
        }
        setLoading(true);
        const details = await fetchElders();
        cache.set(cacheKey, { data: details, ts: Date.now() });
        if (!cancelled) {
          setElders(details);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '加载老人数据失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cacheKey]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const details = await fetchElders();
      cache.set(cacheKey, { data: details, ts: Date.now() });
      setElders(details);
      setError(null);
    } catch (e: any) {
      setError(e?.message || '加载老人数据失败');
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  return { elders, loading, error, reload };
}
