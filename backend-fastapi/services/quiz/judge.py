import json

from src.llm.llmProvider import LlmProvider

VALID_FEEDBACK = {"Exact", "Acceptable", "Partial Credit", "Incorrect"}

SYSTEM_PROMPT = (
    "You are grading a short-answer quiz response for a Chinese-language learner. "
    "Compare the user's response to the reference answer and judge how semantically "
    "correct it is, allowing for paraphrasing, synonyms, and minor wording differences. "
    'Respond with a JSON object of the exact form {"score": <float 0-1>, "feedback": '
    '"Exact"|"Acceptable"|"Partial Credit"|"Incorrect", "is_correct": <bool>}. '
    'Use "Exact" for a fully correct/equivalent answer, "Acceptable" for a correct '
    'answer with small imperfections, "Partial Credit" for a partially correct answer, '
    'and "Incorrect" for a wrong answer. is_correct should be true for Exact/Acceptable/'
    "Partial Credit and false for Incorrect. Respond with only the JSON object."
)


class QuizJudge:
    """
    Grades short-answer quiz responses via an LLM instead of a local sentence-transformers
    embedding model - same swappable-provider pattern as Whisper/translation
    (LLM_PROVIDER env var - see src/llm/llmProvider.py).
    """

    def __init__(self, provider: LlmProvider = None):
        self._provider = provider

    @property
    def provider(self) -> LlmProvider:
        if self._provider is None:
            self._provider = LlmProvider()
        return self._provider

    def evaluate_short_answer(self, correct_reference: str, user_response: str) -> dict:
        ref_clean = str(correct_reference or "").strip()
        resp_clean = str(user_response or "").strip()

        # Instant rejection for completely empty string inputs
        if not ref_clean or not resp_clean:
            return {"score": 0.0, "feedback": "Incorrect", "is_correct": False}

        # Exact string match short-circuits the LLM call entirely
        if ref_clean == resp_clean:
            return {"score": 1.0, "feedback": "Exact", "is_correct": True}

        user_message = json.dumps(
            {"reference_answer": ref_clean, "user_response": resp_clean}, ensure_ascii=False
        )

        try:
            content = self.provider.chat_complete(system=SYSTEM_PROMPT, user=user_message, json_mode=True)
            result = json.loads(content)
            feedback = result.get("feedback")

            if feedback not in VALID_FEEDBACK:
                raise ValueError(f"Unexpected feedback value: {feedback!r}")

            return {
                "score": round(float(result.get("score", 0.0)), 4),
                "feedback": feedback,
                "is_correct": bool(result.get("is_correct", feedback != "Incorrect")),
            }
        except Exception as e:
            print(f"QuizJudge: LLM grading failed, defaulting to Incorrect: {e}")
            return {"score": 0.0, "feedback": "Incorrect", "is_correct": False}
