from datetime import datetime, timezone


def validate(event: dict) -> dict:
    """
    ルールベースの機械検証。D-004の方針に従いAI判定は使わない。
    結果として validated_event に検証フラグを付与して返す。
    """
    issues = []

    # 必須項目チェック
    for field in ("title", "start_datetime", "venue"):
        if not event.get(field):
            issues.append(f"missing_{field}")

    # 日時妥当性チェック
    if event.get("start_datetime"):
        try:
            dt = datetime.fromisoformat(event["start_datetime"])
            if dt < datetime.now(timezone.utc):
                issues.append("past_event")
        except ValueError:
            issues.append("invalid_datetime_format")

    # 中止・延期キーワード検知
    cancel_keywords = ["中止", "延期", "キャンセル", "中断", "払い戻し"]
    text = f"{event.get('title', '')} {event.get('description', '')}"
    if any(kw in text for kw in cancel_keywords):
        issues.append("possible_cancellation")
        event["is_cancelled"] = True

    # source_rank による auto_publish_eligible 判定（D-003）
    rank = event.get("source_rank", "C")
    eligible = (
        rank == "A"
        and not issues
        and not event.get("is_cancelled", False)
    )

    event["validation_issues"] = issues
    event["auto_publish_eligible"] = eligible
    event["confidence_score"] = _calc_confidence(event, issues)
    return event


def _calc_confidence(event: dict, issues: list) -> float:
    score = 1.0
    deductions = {
        "missing_title": 0.5,
        "missing_start_datetime": 0.3,
        "missing_venue": 0.1,
        "past_event": 0.2,
        "invalid_datetime_format": 0.3,
        "possible_cancellation": 0.4,
    }
    for issue in issues:
        score -= deductions.get(issue, 0.1)
    return max(0.0, round(score, 2))
