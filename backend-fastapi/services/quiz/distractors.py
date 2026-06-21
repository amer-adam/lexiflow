import json
import pypinyin
import numpy as np
from typing import List, Dict, Any

from src.llm.llmProvider import LlmProvider

SYSTEM_PROMPT = (
    "You are selecting plausible wrong-answer distractors for a Chinese vocabulary quiz. "
    "Given a target word, the sentence it appears in, and a pool of candidate words, rate "
    "how plausible each candidate is as a distractor (a word a learner might mistakenly "
    "pick instead of the target - similar meaning, similar usage context, or otherwise "
    "easily confused) on a 0-1 scale, where 1 is highly plausible and 0 is not plausible "
    'at all. Respond with a JSON object of the exact form {"scores": {"<candidate>": '
    '<float 0-1>, ...}} containing every candidate from the pool exactly once. Respond '
    "with only the JSON object."
)


class DistractorPipeline:
    """
    Ranks distractor candidates using an LLM for semantic/contextual plausibility (swappable
    via LLM_PROVIDER - see src/llm/llmProvider.py) combined with local pinyin/visual-similarity
    heuristics. Previously used a local sentence-transformers embedding model plus a
    bert-base-chinese fill-mask pipeline for the semantic half.
    """

    def __init__(self, provider: LlmProvider = None):
        self._provider = provider

        # Micro radical database containing frequent components for structural overlap detection
        self.radical_map = {
            '说': ['讠', '兑'], '语': ['讠', '吾'], '话': ['讠', '舌'], '读': ['讠', '卖'],
            '买': ['乛', '头'], '卖': ['十', '买'], '们': ['亻', '门'], '他': ['亻', '也'],
            '你': ['亻', '尔'], '估': ['亻', '古'], '银': ['钅', '艮'], '钢': ['钅', '冈'],
            '店': ['广', '占'], '庙': ['广', '由'], '学': ['⺌', '冖', '子'], '字': ['宀', '子']
        }

    @property
    def provider(self) -> LlmProvider:
        if self._provider is None:
            self._provider = LlmProvider()
        return self._provider

    # --- SEMANTIC + CONTEXT PLAUSIBILITY (LLM) ---
    def get_llm_plausibility(self, target_word: str, context_sentence: str, candidate_pool: List[str]) -> Dict[str, float]:
        if not candidate_pool:
            return {}

        user_message = json.dumps({
            "target_word": target_word,
            "context_sentence": context_sentence or "",
            "candidates": candidate_pool,
        }, ensure_ascii=False)

        try:
            content = self.provider.chat_complete(system=SYSTEM_PROMPT, user=user_message, json_mode=True)
            scores = json.loads(content).get("scores", {})
            return {word: float(scores.get(word, 0.0)) for word in candidate_pool}
        except Exception as e:
            print(f"DistractorPipeline: LLM plausibility scoring failed, defaulting to 0.0: {e}")
            return {word: 0.0 for word in candidate_pool}

    # --- PIPELINE C: PINYIN DISTRACTORS ---
    def calculate_pinyin_similarity(self, word_a: str, word_b: str) -> float:
        py_a = "".join([item[0] for item in pypinyin.pinyin(word_a, style=pypinyin.Style.NORMAL)])
        py_b = "".join([item[0] for item in pypinyin.pinyin(word_b, style=pypinyin.Style.NORMAL)])

        if not py_a or not py_b:
            return 0.0

        # Calculate standard Normalized Levenshtein Distance matrix
        lev_distance = self._levenshtein_distance(py_a, py_b)
        max_len = max(len(py_a), len(py_b))
        return 1.0 - (lev_distance / max_len)

    # --- PIPELINE D: VISUAL DISTRACTORS ---
    def calculate_visual_similarity(self, word_a: str, word_b: str) -> float:
        # Step 1: Intersection analysis via radical_map lookup strings
        radicals_a = set(self.radical_map.get(word_a, list(word_a)))
        radicals_b = set(self.radical_map.get(word_b, list(word_b)))

        intersection = radicals_a.intersection(radicals_b)
        union = radicals_a.union(radicals_b)

        jaccard_radical = len(intersection) / len(union) if union else 0.0

        # Step 2: Unicode structural distance computation block
        unicode_diffs = [abs(ord(ca) - ord(cb)) for ca, cb in zip(word_a, word_b)]
        unicode_score = 1.0 / (1.0 + np.mean(unicode_diffs)) if unicode_diffs else 0.0

        return (jaccard_radical * 0.7) + (unicode_score * 0.3)

    # --- FINAL COMPOSITE RANKING HEURISTIC ---
    def rank_distractors(
        self,
        target_word: str,
        context_sentence: str,
        candidate_pool: List[str],
        top_n: int = 3
    ) -> List[str]:
        # Clean candidates list
        candidates = [w for w in candidate_pool if w.strip() and w != target_word]
        if not candidates:
            return []

        semantic_scores = self.get_llm_plausibility(target_word, context_sentence, candidates)

        scored_candidates = []
        for word in candidates:
            # 1. Base value from the LLM's semantic/context plausibility judgment
            combined_semantic = semantic_scores.get(word, 0.0)

            # 2. Structural Heuristics
            pinyin_sim = self.calculate_pinyin_similarity(target_word, word)
            visual_sim = self.calculate_visual_similarity(target_word, word)

            # 3. Penalties
            exact_penalty = 1.0 if word == target_word else 0.0

            # Math execution block matching target specification exactly
            total_score = combined_semantic + pinyin_sim + visual_sim - exact_penalty

            scored_candidates.append((word, total_score))

        # Sorting records safely using standard matrix parameters descending
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return [word for word, score in scored_candidates[:top_n]]

    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]
