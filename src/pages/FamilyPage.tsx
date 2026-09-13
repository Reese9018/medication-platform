import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Link2, Unlink, CheckCircle2,
  Bell, ArrowRight, Info, Clock, X, Check,
  LogOut, Phone, CircleUserRound, ChevronRight, KeyRound, PencilLine,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle } from '@/components/ui/Common';
import { FAMILY_NOTIFICATIONS } from '@/data/familyDemo';
import { familyApi, authApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export function FamilyPage() {
  const { user } = useApp();
  // 家属端：我的管理中心
  if (user?.role === 'family') {
    return <FamilyMineView />;
  }
  // 老人端：管理家属绑定（保持原样）
  return <ElderFamilyView />;
}

// ============ 老人视角：家属绑定管理（保持原样，未改动） ============
function ElderFamilyView() {
  const { familyMembers, incomingRequests, outgoingRequests, sendFamilyRequest, acceptFamilyRequest, rejectFamilyRequest, unbindMember, showToast } = useApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [account, setAccount] = useState('');
  const [relation, setRelation] = useState('儿子');

  const handleInvite = async () => {
    if (!account.trim()) { showToast('请输入对方账号', 'error'); return; }
    const ok = await sendFamilyRequest(account.trim(), relation);
    if (ok) { setInviteOpen(false); setAccount(''); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <SectionTitle
        title="家属监护"
        subtitle="邀请家属绑定，让他们远程了解您的健康状态"
        icon={<Users size={22} />}
        right={<Button icon={<UserPlus size={16} />} onClick={() => setInviteOpen(true)}>邀请家属</Button>}
      />

      <Card className="p-5 bg-gradient-to-r from-sage-50/60 to-sky-50/40 border-sage-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600 shrink-0">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-semibold text-sage-800">即使不在身边，家人也能安心</h3>
            <p className="text-sm text-sage-600 mt-1">绑定申请发出后需对方同意，绑定成功后家属才能远程查看您的服药、健康数据与 AI 风险提醒。</p>
          </div>
        </div>
      </Card>

      {incomingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sage-800 flex items-center gap-2">
            <Clock size={18} className="text-amber-500" /> 收到的绑定申请
            <Badge level="neutral">{incomingRequests.length}</Badge>
          </h3>
          {incomingRequests.map((req) => (
            <Card key={req.id} className="p-4 border-amber-200 bg-amber-50/40">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 font-semibold shrink-0">
                  {req.peerName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sage-800">{req.requesterName} <span className="text-sage-500 font-normal text-sm">请求绑定您</span></p>
                  <p className="text-xs text-sage-500 mt-0.5">关系称呼：{req.relationship}{req.peerPhone ? ` · ${req.peerPhone}` : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="secondary" icon={<X size={14} />} onClick={() => rejectFamilyRequest(req.id)}>拒绝</Button>
                  <Button size="sm" icon={<Check size={14} />} onClick={() => acceptFamilyRequest(req.id)}>同意</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sage-800 flex items-center gap-2">
            <Clock size={18} className="text-sky-500" /> 我发出的申请
          </h3>
          {outgoingRequests.map((req) => (
            <Card key={req.id} className="p-4 bg-sky-50/40 border-sky-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 font-semibold shrink-0">
                  {req.peerName[0]}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sage-800">已向 {req.peerName} 发起申请</p>
                  <p className="text-xs text-sage-500 mt-0.5">等待对方同意 · 关系称呼：{req.relationship}</p>
                </div>
                <Badge level="neutral">等待同意</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-sage-800 flex items-center gap-2">
          <Users size={18} className="text-sage-600" /> 已绑定家属
        </h3>
        {familyMembers.length === 0 ? (
          <Card className="p-8 text-center text-sm text-sage-500">
            还没有已绑定的家属，点右上角「邀请家属」发起绑定申请
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {familyMembers.map((f) => (
              <Card key={f.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-semibold" style={{ backgroundColor: f.avatarColor }}>
                      {f.name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sage-800">{f.name}</h3>
                      <p className="text-xs text-sage-500">{f.relationship} · {f.phone || '未填写电话'}</p>
                    </div>
                  </div>
                  <Badge level="low"><CheckCircle2 size={13} /> 已绑定</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-sage-500 flex items-center gap-1"><Link2 size={13} /> 实时同步健康数据</span>
                  <Button size="sm" variant="danger" icon={<Unlink size={14} />} onClick={() => unbindMember(f.id)}>解除绑定</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="邀请家属绑定" size="sm"
        footer={<><Button variant="secondary" onClick={() => setInviteOpen(false)}>取消</Button><Button icon={<Link2 size={16} />} onClick={handleInvite}>发送申请</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-sage-600">输入家属的登录账号，系统会向 TA 发送绑定申请，对方同意后即可建立绑定关系。</p>
          <div>
            <label className="label">家属账号</label>
            <input className="input" placeholder="如：family 或对方注册的账号" value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <div>
            <label className="label">关系称呼</label>
            <input className="input" placeholder="如：儿子 / 女儿 / 老伴" value={relation} onChange={(e) => setRelation(e.target.value)} />
          </div>
          <div className="p-3 bg-sage-50 rounded-xl text-xs text-sage-500 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            申请发送后，对方在「家属监护」页会收到「XX 请求绑定您」，同意后才会共享数据。
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ 家属视角：我的管理中心 ============
function FamilyMineView() {
  const { user, outgoingRequests, incomingRequests, acceptFamilyRequest, rejectFamilyRequest, sendFamilyRequest, logout, updateUser, showToast } = useApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [account, setAccount] = useState('');
  const [relation, setRelation] = useState('母亲');
  const [noticeFilter, setNoticeFilter] = useState<'全部' | '用药' | '健康' | '家庭'>('全部');
  const [noticeRead, setNoticeRead] = useState<Record<string, boolean>>({});
  const [members, setMembers] = useState<{ id: string; name: string; relationship?: string; phone?: string }[]>([]);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', gender: '女', height: '', weight: '', blood_type: 'A', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    familyApi.listMembers().then(setMembers).catch(() => {});
  }, []);

  const openEdit = () => {
    setForm({
      name: user?.name || '',
      age: user?.age ? String(user.age) : '',
      gender: user?.gender || '女',
      height: user?.height ? String(user.height) : '',
      weight: user?.weight ? String(user.weight) : '',
      blood_type: user?.bloodType || 'A',
      phone: user?.phone || '',
    });
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!form.name.trim()) { showToast('姓名不能为空', 'error'); return; }
    setSavingProfile(true);
    try {
      await updateUser({
        name: form.name.trim(),
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        bloodType: form.blood_type,
        phone: form.phone || undefined,
      });
      showToast('资料已更新');
      setEditOpen(false);
    } catch {
      showToast('保存失败，请重试', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) { showToast('请完整填写三项密码', 'error'); return; }
    if (newPwd.length < 6) { showToast('新密码至少 6 位', 'error'); return; }
    if (newPwd !== confirmPwd) { showToast('两次输入的新密码不一致', 'error'); return; }
    setSavingPwd(true);
    try {
      await authApi.changePassword(oldPwd, newPwd);
      showToast('密码已修改，请重新登录');
      setTimeout(() => { logout(); }, 1200);
    } catch (e: any) {
      showToast(e?.response?.data?.detail || '修改密码失败，请检查原密码', 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  const notices = FAMILY_NOTIFICATIONS.filter((n) => noticeFilter === '全部' || n.category === noticeFilter);

  const handleInvite = async () => {
    if (!account.trim()) { showToast('请输入老人账号', 'error'); return; }
    const ok = await sendFamilyRequest(account.trim(), relation);
    if (ok) { setInviteOpen(false); setAccount(''); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 用户卡片 */}
      <Card className="p-6 bg-gradient-to-r from-sage-700 to-sage-600 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
            <CircleUserRound size={36} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{user?.name || '王女士'}</h2>
            <p className="text-sage-100/80 text-sm mt-0.5">子女 / 家属账户</p>
          </div>
        </div>
      </Card>

      {/* 家庭成员 */}
      <Card>
        <div className="p-4 border-b border-sage-50 flex items-center justify-between">
          <h3 className="font-semibold text-sage-800 flex items-center gap-2"><Users size={18} className="text-sage-600" /> 家庭成员</h3>
          <Button size="sm" variant="secondary" icon={<UserPlus size={14} />} onClick={() => setInviteOpen(true)}>添加家人</Button>
        </div>
        <div className="p-4 space-y-2.5">
          {members.length === 0 && <p className="text-xs text-sage-400 py-2">还没有绑定老人，点右上角「添加家人」发起绑定。</p>}
          {members.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50/40 border border-sage-50">
              <div className="w-11 h-11 rounded-xl bg-sage-100 text-sage-600 flex items-center justify-center font-semibold shrink-0">
                {e.name[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-sage-800">{e.name}</p>
                <p className="text-xs text-sage-500">{e.relationship || '家人'}{e.phone ? ` · ${e.phone}` : ''}</p>
              </div>
              <Badge level="low"><CheckCircle2 size={12} /> 已绑定</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* 绑定申请 */}
      <Card>
        <div className="p-4 border-b border-sage-50">
          <h3 className="font-semibold text-sage-800 flex items-center gap-2"><Link2 size={18} className="text-sky-600" /> 绑定申请</h3>
        </div>
        <div className="p-4 space-y-3">
          {outgoingRequests.length === 0 && (
            <p className="text-xs text-sage-400">暂无进行中的申请。点击「添加家人」发送绑定申请，老人确认后即可查看其数据。</p>
          )}
          {outgoingRequests.map((req) => (
            <div key={req.id} className="flex items-center gap-3 p-3 bg-sky-50/40 rounded-xl border border-sky-100">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-semibold">{req.peerName[0]}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-sage-800">已向 {req.peerName} 发起申请</p>
                <p className="text-xs text-sage-500">等待对方确认</p>
              </div>
              <Badge level="neutral">等待确认</Badge>
            </div>
          ))}
          {incomingRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-sage-50">
              <p className="text-xs font-medium text-amber-600 pt-2">收到的申请</p>
              {incomingRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 p-3 bg-amber-50/40 rounded-xl border border-amber-100">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-semibold">{req.peerName[0]}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-sage-800">{req.requesterName} 请求绑定您</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" icon={<X size={13} />} onClick={() => rejectFamilyRequest(req.id)}>拒绝</Button>
                    <Button size="sm" icon={<Check size={13} />} onClick={() => acceptFamilyRequest(req.id)}>同意</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* 消息通知 */}
      <Card>
        <div className="p-4 border-b border-sage-50 flex items-center justify-between">
          <h3 className="font-semibold text-sage-800 flex items-center gap-2"><Bell size={18} className="text-amber-500" /> 消息通知</h3>
          <button className="text-xs text-sage-500 hover:text-sage-700" onClick={() => setNoticeRead(Object.fromEntries(FAMILY_NOTIFICATIONS.map((n) => [n.id, true])))}>全部标为已读</button>
        </div>
        <div className="p-4">
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {(['全部', '用药', '健康', '家庭'] as const).map((c) => (
              <button key={c} onClick={() => setNoticeFilter(c)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', noticeFilter === c ? 'bg-sage-600 text-white' : 'bg-cream-100 text-sage-500')}>{c}</button>
            ))}
          </div>
          <div className="space-y-2">
            {notices.map((n) => {
              const read = noticeRead[n.id];
              return (
                <div key={n.id} className={cn('flex items-start gap-2.5 p-3 rounded-xl border', read ? 'bg-cream-50/40 border-sage-50 opacity-60' : 'bg-white border-sage-100')}>
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    n.level === 'danger' ? 'bg-coral-100 text-coral-600' : n.level === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600',
                  )}>
                    <Bell size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-sage-800">{n.title} <span className="text-xs font-normal text-sage-400">· {n.time}</span></p>
                    <p className="text-xs text-sage-500 mt-0.5">{n.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 个人信息 */}
      <Card>
        <div className="p-4 border-b border-sage-50">
          <h3 className="font-semibold text-sage-800 flex items-center gap-2"><CircleUserRound size={18} className="text-sage-600" /> 个人信息</h3>
        </div>
        <div className="p-4 divide-y divide-sage-50">
          <InfoRow label="姓名" value={user?.name || '未填写'} />
          <InfoRow label="手机号" value={user?.phone || '未填写'} icon={<Phone size={13} className="text-sage-300" />} />
          <InfoRow label="年龄" value={user?.age ? `${user.age} 岁` : '未填写'} />
          <InfoRow label="性别" value={user?.gender || '未填写'} />
          <InfoRow label="身高" value={user?.height ? `${user.height} cm` : '未填写'} />
          <InfoRow label="体重" value={user?.weight ? `${user.weight} kg` : '未填写'} />
          <InfoRow label="血型" value={user?.bloodType || '未填写'} />
          <InfoRow label="身份" value="子女 / 家属" />
          <button className="w-full flex items-center justify-between py-3 text-sm text-sage-700 hover:bg-sage-50 rounded-lg px-2 -mx-2 transition" onClick={openEdit}>
            <span className="flex items-center gap-2"><PencilLine size={15} /> 编辑资料</span>
            <ChevronRight size={15} />
          </button>
          <button className="w-full flex items-center justify-between py-3 text-sm text-sage-700 hover:bg-sage-50 rounded-lg px-2 -mx-2 transition" onClick={() => setPwdOpen(true)}>
            <span className="flex items-center gap-2"><KeyRound size={15} /> 修改密码</span>
            <ChevronRight size={15} />
          </button>
          <button className="w-full flex items-center justify-between py-3 text-sm text-coral-600 hover:bg-coral-50 rounded-lg px-2 -mx-2 transition" onClick={logout}>
            <span className="flex items-center gap-2"><LogOut size={15} /> 退出登录</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </Card>

      {/* 编辑资料 Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="编辑个人资料" size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>取消</Button><Button loading={savingProfile} onClick={handleSaveProfile}>保存</Button></>}>
        <div className="space-y-3">
          <div>
            <label className="label">姓名</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">年龄</label>
              <input type="number" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div>
              <label className="label">性别</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="女">女</option>
                <option value="男">男</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">身高 (cm)</label>
              <input type="number" className="input" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
            </div>
            <div>
              <label className="label">体重 (kg)</label>
              <input type="number" className="input" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">血型</label>
            <select className="input" value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
              {['A','B','AB','O','未知'].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label">手机号</label>
            <input className="input" placeholder="如：13800000000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* 修改密码 Modal */}
      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="修改登录密码" size="sm"
        footer={<><Button variant="secondary" onClick={() => setPwdOpen(false)}>取消</Button><Button loading={savingPwd} onClick={handleChangePassword}>保存新密码</Button></>}>
        <div className="space-y-3">
          <div>
            <label className="label">原密码</label>
            <input type="password" className="input" placeholder="请输入当前密码" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
          </div>
          <div>
            <label className="label">新密码</label>
            <input type="password" className="input" placeholder="至少 6 位" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <div>
            <label className="label">确认新密码</label>
            <input type="password" className="input" placeholder="再次输入新密码" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* 添加家人 Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="添加家人" size="sm"
        footer={<><Button variant="secondary" onClick={() => setInviteOpen(false)}>取消</Button><Button icon={<Link2 size={16} />} onClick={handleInvite}>发送申请</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-sage-600">输入老人的登录账号，系统会向 TA 发送绑定申请，对方同意后您即可远程查看其用药与健康数据。</p>
          <div>
            <label className="label">老人账号</label>
            <input className="input" placeholder="如：elder 或对方注册的账号" value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <div>
            <label className="label">关系称呼</label>
            <input className="input" placeholder="如：母亲 / 父亲 / 爷爷" value={relation} onChange={(e) => setRelation(e.target.value)} />
          </div>
          <div className="p-3 bg-sage-50 rounded-xl text-xs text-sage-500 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            申请发送后，老人端会收到申请，同意后才会共享数据。
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-sage-500 flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-sm text-sage-800 font-medium flex items-center gap-1">
        {value} <ArrowRight size={13} className="text-sage-300" />
      </span>
    </div>
  );
}
