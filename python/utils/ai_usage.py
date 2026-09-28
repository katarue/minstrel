"""
Claude API 呼び出し回数・トークン数・概算コストを集計する。
パイプライン全体で claude-haiku-4-5 のみを使用しているため単一料金で概算する。
"""

# claude-haiku-4-5 料金（$ / 1M tokens）
_PRICE_INPUT_PER_M = 1.00
_PRICE_OUTPUT_PER_M = 5.00

_calls = 0
_input_tokens = 0
_output_tokens = 0


def record(resp) -> None:
    """client.messages.create() のレスポンスから使用量を加算する。"""
    global _calls, _input_tokens, _output_tokens
    _calls += 1
    usage = getattr(resp, "usage", None)
    if usage is not None:
        _input_tokens += getattr(usage, "input_tokens", 0) or 0
        _output_tokens += getattr(usage, "output_tokens", 0) or 0


def summary_line() -> str:
    cost = (_input_tokens / 1_000_000) * _PRICE_INPUT_PER_M + (_output_tokens / 1_000_000) * _PRICE_OUTPUT_PER_M
    return (
        f"[ai_usage] calls={_calls} input_tokens={_input_tokens} "
        f"output_tokens={_output_tokens} est_cost=${cost:.4f}"
    )


def reset() -> None:
    global _calls, _input_tokens, _output_tokens
    _calls = 0
    _input_tokens = 0
    _output_tokens = 0
