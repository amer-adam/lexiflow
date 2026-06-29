import re
import pypinyin
import numpy as np
from typing import List, Dict, Any

# English dictionary-gloss words too common to signal anything about meaning
# similarity (CC-CEDICT-style definitions are full of these connectives).
_STOPWORDS = {
    "to", "a", "an", "the", "of", "in", "on", "at", "for", "and", "or", "is",
    "are", "be", "by", "as", "it", "this", "that", "with", "from", "etc",
    "also", "used", "used", "one", "used", "cl",
}


def _meaning_tokens(meaning: str) -> set:
    if not meaning:
        return set()
    words = re.findall(r"[a-z']+", meaning.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 1}


class DistractorPipeline:
    """
    Ranks distractor candidates using purely local heuristics - no network
    call and no ML model, so quiz generation latency is bounded by plain
    string/set math instead of an API round trip. Combines:

      - meaning overlap: shared English gloss tokens between the target
        word's dictionary definition and a candidate's (CC-CEDICT-style
        definitions group related/synonymous words under similar
        descriptive vocabulary, so token overlap is a decent cheap proxy for
        "is this candidate a plausible same-category wrong answer").
      - pinyin similarity: how close the two words sound.
      - visual similarity: shared radicals/characters.

    History: this used to call an LLM for the semantic half (and before
    that, a local sentence-transformers embedding model + a bert-base-chinese
    fill-mask pipeline). Both were replaced because neither could reliably
    stay inside this app's quiz-generation latency budget (a live API call
    cannot be bounded below a few seconds, and this app's production
    deployment - a 2GB RAM box - can't fit torch + two transformer models
    alongside the rest of the stack). This local-only approach trades some
    semantic nuance for latency that's bounded by local computation instead
    of a network call.
    """

    def __init__(self):
        # Micro radical database containing frequent components for structural overlap detection
        self.radical_map = {
            '说': ['讠', '兑'], '语': ['讠', '吾'], '话': ['讠', '舌'], '读': ['讠', '卖'],
            '买': ['乛', '头'], '卖': ['十', '买'], '们': ['亻', '门'], '他': ['亻', '也'],
            '你': ['亻', '尔'], '估': ['亻', '古'], '银': ['钅', '艮'], '钢': ['钅', '冈'],
            '店': ['广', '占'], '庙': ['广', '由'], '学': ['⺌', '冖', '子'], '字': ['宀', '子']
        }

    # --- PIPELINE A: MEANING OVERLAP ---
    def calculate_meaning_similarity(self, meaning_a: str, meaning_b: str) -> float:
        tokens_a = _meaning_tokens(meaning_a)
        tokens_b = _meaning_tokens(meaning_b)
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        return len(intersection) / len(union) if union else 0.0

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
        candidate_pool: List[str],
        word_meanings: Dict[str, str],
        top_n: int = 3
    ) -> List[str]:
        # Clean candidates list
        candidates = [w for w in candidate_pool if w.strip() and w != target_word]
        if not candidates:
            return []

        target_meaning = word_meanings.get(target_word, "")

        scored_candidates = []
        for word in candidates:
            meaning_sim = self.calculate_meaning_similarity(target_meaning, word_meanings.get(word, ""))
            pinyin_sim = self.calculate_pinyin_similarity(target_word, word)
            visual_sim = self.calculate_visual_similarity(target_word, word)
            total_score = meaning_sim + pinyin_sim + visual_sim
            scored_candidates.append((word, total_score))

        # Sorting records safely using standard matrix parameters descending
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return [word for word, score in scored_candidates[:top_n]]

    # --- FINAL COMPOSITE RANKING HEURISTIC, MANY QUESTIONS AT ONCE ---
    def rank_distractors_batch(
        self,
        requests: List[Dict[str, Any]],
        word_meanings: Dict[str, str],
        top_n: int = 3
    ) -> List[List[str]]:
        """
        Same ranking as rank_distractors, for many questions at once.
        `requests` is a list of {"target_word", "candidate_pool"} dicts;
        returns one distractor list per request, in the same order. Purely
        local computation, so there's no batching/concurrency concern here
        the way there was when this scored candidates via an LLM call.
        """
        return [
            self.rank_distractors(req["target_word"], req["candidate_pool"], word_meanings, top_n)
            for req in requests
        ]

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
