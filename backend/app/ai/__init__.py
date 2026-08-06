"""AI orchestration layer.

Exposes the two capabilities of the AI Data Analyst: automated insight
generation and natural-language question answering.
"""

from .insights import generate_insights
from .nlu import answer

__all__ = ["generate_insights", "answer"]
