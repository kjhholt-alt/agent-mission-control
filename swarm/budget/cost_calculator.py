"""
Cost calculator for API calls based on model and token counts.
"""

from swarm.config import MODEL_COSTS


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in cents for an API call.

    Args:
        model: Model identifier (e.g. "claude-haiku-4-5-20251001")
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Cost in cents (float)

    Raises:
        ValueError: If model is not in the cost registry
    """
    if model not in MODEL_COSTS:
        raise ValueError(
            f"Unknown model '{model}'. Known models: {list(MODEL_COSTS.keys())}"
        )

    rates = MODEL_COSTS[model]
    input_cost = (input_tokens / 1000) * rates["input"]
    output_cost = (output_tokens / 1000) * rates["output"]
    return round(input_cost + output_cost, 4)


def calculate_cost_cents(model: str, input_tokens: int, output_tokens: int) -> int:
    """Calculate cost in cents as an integer (for Supabase INTEGER columns).

    Args:
        model: Model identifier
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Cost in cents rounded to nearest integer
    """
    return int(round(calculate_cost(model, input_tokens, output_tokens)))
