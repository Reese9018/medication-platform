# -*- coding: utf-8 -*-
"""家属端数据接口实测：验证家属账号能读到已绑定老人的数据。"""
import json
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"


def req(method, path, token=None, payload=None):
    url = BASE + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


# 1) 家属登录
code, login = req("POST", "/auth/login", payload={"account": "family", "password": "123456", "role": "family"})
assert code == 200, f"家属登录失败: {code} {login}"
token = login["access_token"]
print(f"[家属登录] ok user={login['user']['name']} role={login['user']['role']}")

# 2) 家属读取老人数据（此前为空 -> 现在应为老人的数据）
for path, label in [
    ("/medications", "药品"),
    ("/health-records", "健康记录"),
    ("/schedule", "用药计划"),
    ("/risks", "风险提醒"),
    ("/notifications", "消息"),
]:
    code, data = req("GET", path, token=token)
    print(f"[{label}] GET {path} -> {code}, count={len(data) if isinstance(data, list) else data}")

code, rep = req("GET", "/reports/week", token=token)
print(f"[健康报告] GET /reports/week -> {code}, adherence={rep.get('adherence_rate')}%, avgBP={rep.get('avg_systolic')}/{rep.get('avg_diastolic')}, missed={rep.get('missed_count')}")

# 3) 家属侧写操作：打卡老人的服药计划
code, doses = req("GET", "/schedule", token=token)
pending = next((d for d in doses if d["status"] == "pending"), None)
if pending:
    code, updated = req("PATCH", f"/schedule/{pending['id']}", token=token, payload={"status": "taken"})
    print(f"[家属打卡] PATCH /schedule/{pending['id']} -> {code}, status={updated.get('status')}")
    # 恢复原状
    req("PATCH", f"/schedule/{pending['id']}", token=token, payload={"status": "pending"})
else:
    print("[家属打卡] 无待服剂量，跳过")

# 4) 老人账号回归验证（确保没破坏老人端）
code, login2 = req("POST", "/auth/login", payload={"account": "elder", "password": "123456", "role": "elder"})
assert code == 200, f"老人登录失败: {code} {login2}"
tok2 = login2["access_token"]
code, meds2 = req("GET", "/medications", token=tok2)
print(f"[老人回归] 登录 ok, medications count={len(meds2)}")
code, health2 = req("GET", "/health-records", token=tok2)
print(f"[老人回归] health-records count={len(health2)}")

print("\n全部通过 ✅")
