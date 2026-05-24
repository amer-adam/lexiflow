from sentence_transformers import SentenceTransformer, util

class QuizJudge:
    def __init__(self):
        self._sbert_model = None

    @property
    def sbert_model(self):
        if self._sbert_model is None:
            self._sbert_model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        return self._sbert_model

    def evaluate_short_answer(self, correct_reference: str, user_response: str) -> dict:
        """
        Calculates cosine similarity metrics and converts them to precise grading evaluations.
        """
        ref_clean = str(correct_reference or "").strip()
        resp_clean = str(user_response or "").strip()

        # Instant rejection for completely empty string inputs
        if not ref_clean or not resp_clean:
            return {
                "score": 0.0,
                "feedback": "Incorrect",
                "is_correct": False
            }

        # Match exact string representations to bypass vector calculation overhead
        if ref_clean == resp_clean:
            return {
                "score": 1.0,
                "feedback": "Exact",
                "is_correct": True
            }

        # Encode tokens and map cosine similarity
        ref_embedding = self.sbert_model.encode(ref_clean, convert_to_tensor=True)
        resp_embedding = self.sbert_model.encode(resp_clean, convert_to_tensor=True)
        
        cosine_similarity = float(util.cos_sim(ref_embedding, resp_embedding)[0][0])

        # Enforce exact threshold classification definitions matching specifications
        if cosine_similarity > 0.90:
            feedback = "Exact"
            is_correct = True
        elif cosine_similarity > 0.80:
            feedback = "Acceptable"
            is_correct = True
        elif cosine_similarity > 0.70:
            feedback = "Partial Credit"
            is_correct = True
        else:
            feedback = "Incorrect"
            is_correct = False

        return {
            "score": round(cosine_similarity, 4),
            "feedback": feedback,
            "is_correct": is_correct
        }