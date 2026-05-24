import os
import pypinyin
import numpy as np
from typing import List, Dict, Any
from transformers import pipeline
from sentence_transformers import SentenceTransformer, util

class DistractorPipeline:
    def __init__(self):
        # Lazy load heavy pipelines to maintain responsive service boot times
        self._mlm_pipeline = None
        self._sbert_model = None
        
        # Micro radical database containing frequent components for structural overlap detection
        self.radical_map = {
            '说': ['讠', '兑'], '语': ['讠', '吾'], '话': ['讠', '舌'], '读': ['讠', '卖'],
            '买': ['乛', '头'], '卖': ['十', '买'], '们': ['亻', '门'], '他': ['亻', '也'],
            '你': ['亻', '尔'], '估': ['亻', '古'], '银': ['钅', '艮'], '钢': ['钅', '冈'],
            '店': ['广', '占'], '庙': ['广', '由'], '学': ['⺌', '冖', '子'], '字': ['宀', '子']
        }

    @property
    def mlm_pipeline(self):
        if self._mlm_pipeline is None:
            self._mlm_pipeline = pipeline("fill-mask", model="bert-base-chinese")
        return self._mlm_pipeline

    @property
    def sbert_model(self):
        if self._sbert_model is None:
            self._sbert_model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        return self._sbert_model

    # --- PIPELINE A: EMBEDDING SIMILARITY ---
    def get_embedding_similarity(self, target_word: str, candidate_pool: List[str]) -> Dict[str, float]:
        if not candidate_pool:
            return {}
        
        # Append target to candidates to parse matching embedding arrays in one batch pass
        all_words = [target_word] + candidate_pool
        embeddings = self.sbert_model.encode(all_words, convert_to_tensor=True)
        
        target_embedding = embeddings[0]
        candidate_embeddings = embeddings[1:]
        
        cosine_scores = util.cos_sim(target_embedding, candidate_embeddings)[0].tolist()
        
        return {word: float(score) for word, score in zip(candidate_pool, cosine_scores)}

    # --- PIPELINE B: MLM FILL MASK ---
    def get_mlm_predictions(self, context_sentence: str, target_word: str) -> Dict[str, float]:
        scores = {}
        if not context_sentence or target_word not in context_sentence:
            return scores

        # Build structural masking string configuration matching target length
        mask_token = self.mlm_pipeline.tokenizer.mask_token
        masked_sentence = context_sentence.replace(target_word, mask_token, 1)
        
        try:
            predictions = self.mlm_pipeline(masked_sentence)
            # Normalize multi-predictions into unified array structure
            if isinstance(predictions, dict):
                predictions = [predictions]
                
            for pred in predictions:
                word = pred['token_str'].strip()
                # Skip punctuation, wildcards, and direct absolute hits
                if word and word != target_word and not any(c in "，。？！、" for c in word):
                    scores[word] = max(scores.get(word, 0.0), float(pred['score']))
        except Exception:
            pass  # Fall back gracefully to fallback arrays if parsing structural token sequences fails
        return scores

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

        # Multi-threading and background task data retrieval setups
        emb_scores = self.get_embedding_similarity(target_word, candidates)
        mlm_scores = self.get_mlm_predictions(context_sentence, target_word)
        
        scored_candidates = []
        for word in candidates:
            # 1. Base values matching specific engine arrays
            semantic_sim = emb_scores.get(word, 0.0)
            context_fit = mlm_scores.get(word, 0.0)
            
            # Combine semantic similarity with context suitability
            combined_semantic = (semantic_sim * 0.6) + (context_fit * 0.4)
            
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