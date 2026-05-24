import re
from typing import Dict, Any, List

class QuizTemplateEngine:
    @staticmethod
    def create_fill_blank(sentence: str, target_word: str) -> Dict[str, str]:
        """
        Replaces the target word inside a context sentence with a clean blank indicator.
        """
        if not sentence or not target_word:
            return {"question_text": sentence, "display_context": ""}
            
        # Case-insensitive replacement handling potential variations
        pattern = re.compile(re.escape(target_word), re.IGNORECASE)
        masked_sentence = pattern.sub("____", sentence)
        
        return {
            "question_text": f"Please fill in the blank with the most appropriate Chinese word based on the context:\n\n{masked_sentence}",
            "masked_context": masked_sentence
        }

    @staticmethod
    def create_short_answer(meaning: str, context_translation: str = None) -> str:
        """
        Builds open-ended translation and recollection prompts.
        """
        prompt = f"Please write the Chinese word that corresponds to the following meaning:\n“{meaning}”"
        if context_translation:
            prompt += f"\n\nContext Clue (English):\n{context_translation}"
        return prompt

    @staticmethod
    def create_true_false_statement(
        word: str, 
        correct_meaning: str, 
        distractor_meaning: str, 
        should_be_true: bool
    ) -> Dict[str, Any]:
        """
        Generates binary statements by dynamically injecting valid or intentionally modified meanings.
        """
        chosen_meaning = correct_meaning if should_be_true else distractor_meaning
        statement = f"True or False: The word '{word}' means '{chosen_meaning}'."
        
        return {
            "question_text": statement,
            "correct_answer": "TRUE" if should_be_true else "FALSE"
        }