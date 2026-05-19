"""
run_scheduler.py を解析し、docs/operations.md のスケジュール表と
Mermaid フロー図を自動更新するスクリプト。

pre-commit hook から自動呼び出し。手動実行も可能:
  python scripts/gen_operations_doc.py
"""
import re
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCHEDULER_PATH = os.path.join(ROOT, "python", "run_scheduler.py")
OPS_DOC_PATH = os.path.join(ROOT, "docs", "operations.md")

# フロー変数名 → (ファイル名, 表示名)
FLOW_META = {
    "collect_flow":             ("flow_collect.py",           "チケット6サイト"),
    "collect_x_flow":           ("flow_collect_x.py",         "X検索・フォローリスト"),
    "collect_organizer_x_flow": ("flow_collect_organizer_x.py", "演奏団体Xプロフ画像"),
    "post_monday_flow":         ("flow_post_weekly.py",       "X自動投稿（月）"),
    "post_friday_flow":         ("flow_post_weekly.py",       "X自動投稿（金）"),
    "post_scheduled_flow":      ("flow_post_scheduled.py",    "X予約投稿"),
}

DOW_JP = {"0": "日", "1": "月", "2": "火", "3": "水", "4": "木", "5": "金", "6": "土"}


def cron_to_japanese(cron: str) -> tuple[str, str]:
    """cron式 → (頻度, 時刻JST) の日本語ペア"""
    parts = cron.strip().split()
    if len(parts) != 5:
        return cron, ""
    minute, hour, dom, _, dow = parts

    # */N 形式（分単位インターバル）
    if minute.startswith("*/") and hour == "*":
        return f"{minute[2:]}分ごと", ""

    time_str = f"{int(hour):02d}:{int(minute):02d}"

    if dow != "*":
        days = "・".join(DOW_JP.get(d, d) for d in dow.split(","))
        return f"{days}曜", time_str
    if dom.startswith("*/"):
        return f"{dom[2:]}日おき", time_str
    if dom != "*":
        return f"毎月{dom}日", time_str
    return "毎日", time_str


def extract_schedules() -> list[dict]:
    """serve-all ブロック内の runner.add_flow() だけを抽出（本番稼働フローのみ）"""
    with open(SCHEDULER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # serve_all ブロックだけを切り出す
    serve_all_match = re.search(
        r"elif args\.serve_all:(.*?)runner\.start\(\)", content, re.DOTALL
    )
    if not serve_all_match:
        return []
    block = serve_all_match.group(1)

    pattern = re.compile(
        r'runner\.add_flow\(\s*(\w+),\s*\n\s*name="[^"]+",\s*\n\s*schedules=\[CronSchedule\(cron="([^"]+)"',
    )
    schedules = []
    for m in pattern.finditer(block):
        flow_var, cron = m.group(1), m.group(2)
        freq, time_str = cron_to_japanese(cron)
        schedules.append({"flow_var": flow_var, "cron": cron, "freq": freq, "time": time_str})
    return schedules


def build_table(schedules: list[dict]) -> str:
    rows = ["| フロー | 対象 | 頻度 | 時刻 (JST) |", "|---|---|---|---|"]
    for s in schedules:
        file_name, target = FLOW_META.get(s["flow_var"], (s["flow_var"], s["flow_var"]))
        rows.append(f"| `{file_name}` | {target} | {s['freq']} | {s['time']} |")
    return "\n".join(rows)


def build_mermaid(schedules: list[dict]) -> str:
    lines = ["```mermaid", "flowchart LR", "    DB[(Supabase)]"]
    for s in schedules:
        _, target = FLOW_META.get(s["flow_var"], (s["flow_var"], s["flow_var"]))
        node_id = s["flow_var"].replace("_", "")
        label = f'{target}\\n{s["freq"]} {s["time"]}'
        if "post" in s["flow_var"]:
            lines.append(f'    DB --> {node_id}["{label}"]')
        else:
            lines.append(f'    {node_id}["{label}"] --> DB')
    lines.append("```")
    return "\n".join(lines)


def update_section(content: str, start_marker: str, end_marker: str, new_body: str) -> str:
    pattern = re.compile(
        re.escape(start_marker) + r".*?" + re.escape(end_marker),
        re.DOTALL,
    )
    replacement = f"{start_marker}\n{new_body}\n{end_marker}"
    return pattern.sub(replacement, content)


def main() -> None:
    schedules = extract_schedules()
    if not schedules:
        print("[gen_operations_doc] スケジュールが見つかりませんでした。スキップします。")
        return

    table = build_table(schedules)
    mermaid = build_mermaid(schedules)

    with open(OPS_DOC_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    content = update_section(content, "<!-- SCHEDULE_TABLE_START -->", "<!-- SCHEDULE_TABLE_END -->", table)
    content = update_section(content, "<!-- PIPELINE_DIAGRAM_START -->", "<!-- PIPELINE_DIAGRAM_END -->", mermaid)

    with open(OPS_DOC_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    print(f"[gen_operations_doc] operations.md を更新しました（{len(schedules)} フロー）")


if __name__ == "__main__":
    main()
