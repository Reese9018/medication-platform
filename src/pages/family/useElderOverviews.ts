import { useEffect, useState } from 'react';
import { familyApi, type ElderOverview } from '@/lib/api';

/**
 * 家属端数据 hook：
 * 1. 拉取当前家属已绑定的老人列表
 * 2. 并发拉取每位老人的真实数据（资料/今日用药/药品/健康记录）
 * 数据全部来自后端，不再使用静态演示数据
 */
export function useElderOverviews() {
  const [elders, setElders] = useState<ElderOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const members = await familyApi.listMembers();
        const details = await Promise.all(
          members.map((m) => familyApi.elderOverview(m.id)),
        );
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
  }, []);

  return { elders, loading, error, reload: async () => {
    try {
      const members = await familyApi.listMembers();
      const details = await Promise.all(members.map((m) => familyApi.elderOverview(m.id)));
      setElders(details);
    } catch { /* ignore */ }
  } };
}
