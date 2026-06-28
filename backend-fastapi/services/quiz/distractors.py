import json
import pypinyin
import numpy as np
from concurrent.futures import ThreadPoolExecutor
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

BATCH_SYSTEM_PROMPT = (
    "You are selecting plausible wrong-answer distractors for several Chinese vocabulary "
    "quiz questions at once. You will receive a JSON array of items, each with an \"index\", "
    "a \"target_word\", its \"context_sentence\", and a pool of \"candidates\". For every "
    "item, rate how plausible each of its candidates is as a distractor for its target word "
    "(a word a learner might mistakenly pick instead of the target - similar meaning, similar "
    "usage context, or otherwise easily confused) on a 0-1 scale, where 1 is highly plausible "
    'and 0 is not plausible at all. Respond with a JSON object of the exact form {"scores": '
    '{"<index>": {"<candidate>": <float 0-1>, ...}, ...}} containing every item index and '
    "every one of its candidates exactly once. Respond with only the JSON object."
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

    # --- SEMANTIC + CONTEXT PLAUSIBILITY (LLM, BATCHED ACROSS QUESTIONS) ---
    def get_llm_plausibility_batch(self, items: List[Dict[str, Any]]) -> Dict[int, Dict[str, float]]:
        """
        Scores candidates for several questions in a single LLM call instead of
        one call per question. `items` is a list of {"index", "target_word",
        "context_sentence", "candidates"} dicts; returns {index: {candidate: score}}.
        """
        if not items:
            return {}

        user_message = json.dumps([
            {
                "index": item["index"],
                "target_word": item["target_word"],
                "context_sentence": item.get("context_sentence") or "",
                "candidates": item["candidates"],
            }
            for item in items
        ], ensure_ascii=False)

        fallback = {item["index"]: {c: 0.0 for c in item["candidates"]} for item in items}

        try:
            content = self.provider.chat_complete(system=BATCH_SYSTEM_PROMPT, user=user_message, json_mode=True)
            raw_scores = json.loads(content).get("scores", {})
            result = {}
            for item in items:
                item_scores = raw_scores.get(str(item["index"]), {})
                result[item["index"]] = {c: float(item_scores.get(c, 0.0)) for c in item["candidates"]}
            return result
        except Exception as e:
            print(f"DistractorPipeline: batched LLM plausibility scoring failed, defaulting to 0.0: {e}")
            return fallback

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

    # Cap on how many candidates ever get sent to the LLM for semantic
    # scoring. Without this, a large source list (e.g. the 150-word HSK 1
    # reference list) puts every single one of its words in the prompt and
    # asks for a score back for each - the resulting prompt/completion size
    # is what made quiz generation take minutes. The structural heuristics
    # below are pure local string math (no network call), so we use them to
    # pick a small, already-plausible shortlist first and only pay the LLM
    # round trip for that shortlist.
    LLM_SHORTLIST_SIZE = 12

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

        # 1. Structural heuristics first (cheap, local) for every candidate.
        structural_scores = {
            word: self.calculate_pinyin_similarity(target_word, word) + self.calculate_visual_similarity(target_word, word)
            for word in candidates
        }

        # 2. Only ask the LLM to semantically score the most structurally
        # plausible shortlist, not the whole pool.
        shortlist = sorted(candidates, key=lambda w: structural_scores[w], reverse=True)[: self.LLM_SHORTLIST_SIZE]
        semantic_scores = self.get_llm_plausibility(target_word, context_sentence, shortlist)

        scored_candidates = []
        for word in candidates:
            # Base value from the LLM's semantic/context plausibility
            # judgment, where available (only the shortlist was scored).
            combined_semantic = semantic_scores.get(word, 0.0)
            total_score = combined_semantic + structural_scores[word]
            scored_candidates.append((word, total_score))

        # Sorting records safely using standard matrix parameters descending
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return [word for word, score in scored_candidates[:top_n]]

    # How many questions' worth of distractor scoring go into a single LLM
    # call. Below this, one call covers the whole quiz; above it, requests
    # are split into chunks of this size rather than one call per question.
    BATCH_SIZE = 10

    # --- FINAL COMPOSITE RANKING HEURISTIC, BATCHED ACROSS QUESTIONS ---
    def rank_distractors_batch(
        self,
        requests: List[Dict[str, Any]],
        top_n: int = 3
    ) -> List[List[str]]:
        """
        Same ranking as rank_distractors, but for many questions at once: the
        LLM semantic-scoring call is batched in groups of BATCH_SIZE questions
        (all of them in one call if there are 10 or fewer) instead of firing
        one LLM call per question. `requests` is a list of
        {"target_word", "context_sentence", "candidate_pool"} dicts; returns
        one distractor list per request, in the same order.
        """
        if not requests:
            return []

        # 1. Clean candidates and compute structural heuristics locally
        # (cheap) for every request, building each one's LLM shortlist.
        per_request_candidates: List[List[str]] = []
        per_request_structural: List[Dict[str, float]] = []
        llm_items: List[Dict[str, Any]] = []

        for i, req in enumerate(requests):
            target_word = req["target_word"]
            candidates = [w for w in req["candidate_pool"] if w.strip() and w != target_word]
            per_request_candidates.append(candidates)

            structural_scores = {
                word: self.calculate_pinyin_similarity(target_word, word) + self.calculate_visual_similarity(target_word, word)
                for word in candidates
            }
            per_request_structural.append(structural_scores)

            if candidates:
                shortlist = sorted(candidates, key=lambda w: structural_scores[w], reverse=True)[: self.LLM_SHORTLIST_SIZE]
                llm_items.append({
                    "index": i,
                    "target_word": target_word,
                    "context_sentence": req.get("context_sentence"),
                    "candidates": shortlist,
                })

        # 2. Fetch semantic scores in chunks of BATCH_SIZE questions per LLM
        # call (a single call if there are BATCH_SIZE or fewer questions).
        # Multiple chunks are fired concurrently rather than one after
        # another - sequential chunks were ending up SLOWER than the old
        # one-call-per-question approach (which ran fully in parallel), and
        # for a long quiz that pushed total wall time past the reverse
        # proxy/CDN's idle timeout, killing the connection ("socket hang up")
        # before a response ever came back.
        chunks = [llm_items[start:start + self.BATCH_SIZE] for start in range(0, len(llm_items), self.BATCH_SIZE)]
        semantic_scores_by_index: Dict[int, Dict[str, float]] = {}
        if chunks:
            with ThreadPoolExecutor(max_workers=len(chunks)) as executor:
                for chunk_result in executor.map(self.get_llm_plausibility_batch, chunks):
                    semantic_scores_by_index.update(chunk_result)

        # 3. Combine semantic + structural scores per request and pick top_n.
        results: List[List[str]] = []
        for i, candidates in enumerate(per_request_candidates):
            if not candidates:
                results.append([])
                continue

            structural_scores = per_request_structural[i]
            semantic_scores = semantic_scores_by_index.get(i, {})

            scored_candidates = [
                (word, semantic_scores.get(word, 0.0) + structural_scores[word])
                for word in candidates
            ]
            scored_candidates.sort(key=lambda x: x[1], reverse=True)
            results.append([word for word, _ in scored_candidates[:top_n]])

        return results

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
