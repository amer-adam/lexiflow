import random
from typing import List, Dict, Any
from .templates import QuizTemplateEngine
from .distractors import DistractorPipeline

class QuizGenerator:
    def __init__(self):
        self.distractor_pipeline = DistractorPipeline()

    def generate_quiz(self, vocab_items: List[Dict[str, Any]], count: int, allowed_types: List[str]) -> List[Dict[str, Any]]:
        """
        Orchestrates full quiz package compilation from a provided context-mapped vocabulary array.
        Dynamically branches into varied question layouts (pinyin, meanings, masked contexts).
        """
        questions = []
        if not vocab_items or not allowed_types:
            return questions

        # Establish global candidate pools for fallback matching
        candidate_pool = [item.get('simplified') for item in vocab_items if item.get('simplified')]
        meaning_pool = [item.get('meaning') for item in vocab_items if item.get('meaning')]

        if not candidate_pool:
            return questions

        # Select target items up to requested total count
        sampled_items = random.sample(vocab_items, min(len(vocab_items), count))

        # Decide each item's question type up front so MULTIPLE_CHOICE/TRUE_FALSE
        # distractor lookups can be sent to the LLM as one batched request
        # (10 questions per call - see DistractorPipeline.BATCH_SIZE) instead
        # of one blocking call per question, which can add up to minutes for
        # a multi-question quiz and risks the connection dropping before the
        # response is ready.
        item_plans = []
        for item in sampled_items:
            word = item.get('simplified')
            context = item.get('contextSentence', '') or ''

            item_allowed_types = allowed_types.copy()
            if not (context and word in context):
                if "FILL_BLANK" in item_allowed_types:
                    item_allowed_types.remove("FILL_BLANK")
                if not item_allowed_types:
                    # Fallback to other types if FILL_BLANK was the only allowed type but no context exists
                    item_allowed_types = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "TRUE_FALSE"]

            q_type = random.choice(item_allowed_types)
            item_plans.append((item, q_type))

        distractor_requests = []
        distractor_request_idx = []
        for idx, (item, q_type) in enumerate(item_plans):
            if q_type not in ("MULTIPLE_CHOICE", "TRUE_FALSE"):
                continue
            distractor_requests.append({
                "target_word": item.get('simplified'),
                "context_sentence": item.get('contextSentence', '') or '',
                "candidate_pool": candidate_pool,
            })
            distractor_request_idx.append(idx)

        distractor_results = self.distractor_pipeline.rank_distractors_batch(distractor_requests, top_n=3)

        distractors_by_idx = [None] * len(item_plans)
        for idx, result in zip(distractor_request_idx, distractor_results):
            distractors_by_idx[idx] = result

        for idx, (item, q_type) in enumerate(item_plans):
            word = item.get('simplified')
            pinyin = item.get('pinyin', '')
            meaning = item.get('meaning', '')
            context = item.get('contextSentence', '') or ''
            translation = item.get('contextTranslation', '') or ''
            vocab_item_id = item.get('id') or item.get('vocabularyListItemId')

            # Build declarative foundation payload matching downstream schemas
            question_data = {
                "id": f"question_{idx}_{random.randint(10000, 99999)}",
                "vocabListItemId": vocab_item_id,
                "word": word,
                "type": q_type,
                "question_text": "",
                "options": [],
                "correct_answer": word,
                "context_sentence": context
            }

            # --- RENDER BLOCK BY QUESTION TYPE ---
            if q_type == "MULTIPLE_CHOICE":
                distractors = list(distractors_by_idx[idx] or [])
                # The only fallback source is the source vocabulary list
                # itself, so cap how many distractors we can ever add: a
                # list with fewer than 4 distinct words cannot supply 3
                # fallback distractors, and retrying for more than exist
                # would loop forever. Take whatever distinct words remain
                # (possibly fewer than 3) instead of hanging the request.
                remaining_pool = [w for w in set(candidate_pool) if w != word and w not in distractors]
                random.shuffle(remaining_pool)
                while len(distractors) < 3 and remaining_pool:
                    distractors.append(remaining_pool.pop())

                # VARIETY BRANCHING FOR MULTIPLE CHOICE
                mc_variant = random.choice(["MEANING_TO_WORD", "WORD_TO_MEANING", "WORD_TO_PINYIN", "PINYIN_TO_WORD", "CONTEXT_CLOZE", "PINYIN_TO_MEANING", "MEANING_TO_PINYIN"])
                
                if mc_variant == "MEANING_TO_WORD":
                    options = distractors + [word]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = word
                    question_data["question_text"] = f"Select the correct Chinese word that matches the meaning '{meaning}'.\nContext: {context or 'No context available'}"
                
                elif mc_variant == "WORD_TO_MEANING":
                    # Collect option definitions instead of characters
                    alt_meanings = []
                    for d in distractors:
                        matched = next((i for i in vocab_items if i.get('simplified') == d), None)
                        alt_meanings.append(matched.get('meaning') if matched else "unknown meaning")
                    
                    options = alt_meanings + [meaning]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = meaning
                    question_data["question_text"] = f"Select the correct meaning for the Chinese word '{word}'."

                elif mc_variant == "WORD_TO_PINYIN":
                    alt_pinyins = []
                    for d in distractors:
                        matched = next((i for i in vocab_items if i.get('simplified') == d), None)
                        alt_pinyins.append(matched.get('pinyin') if matched else "xīnxī")
                    
                    options = alt_pinyins + [pinyin]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = pinyin
                    question_data["question_text"] = f"Select the correct Pinyin for the Chinese word '{word}'."
                
                elif mc_variant == "PINYIN_TO_WORD":
                    options = distractors + [word]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = word
                    question_data["question_text"] = f"Select the correct Chinese word for the Pinyin '{pinyin}'.\nDefinition: {meaning}"
                
                elif mc_variant == "CONTEXT_CLOZE":
                    options = distractors + [word]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = word
                    if context and word in context:
                        masked_context = context.replace(word, " ____ ")
                        question_data["question_text"] = f"Select the most appropriate Chinese word to fill in the blank in the sentence below:\n\n“{masked_context}”"
                    else:
                        question_data["question_text"] = f"Select the correct Chinese word that matches the meaning '{meaning}'.\nContext: {context or 'No context available'}"

                elif mc_variant == "PINYIN_TO_MEANING":
                    alt_meanings = []
                    for d in distractors:
                        matched = next((i for i in vocab_items if i.get('simplified') == d), None)
                        alt_meanings.append(matched.get('meaning') if matched else "unknown meaning")
                    
                    options = alt_meanings + [meaning]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = meaning
                    question_data["question_text"] = f"Select the correct meaning for the Pinyin '{pinyin}'."

                elif mc_variant == "MEANING_TO_PINYIN":
                    alt_pinyins = []
                    for d in distractors:
                        matched = next((i for i in vocab_items if i.get('simplified') == d), None)
                        alt_pinyins.append(matched.get('pinyin') if matched else "xīnxī")
                    
                    options = alt_pinyins + [pinyin]
                    random.shuffle(options)
                    question_data["options"] = options
                    question_data["correct_answer"] = pinyin
                    question_data["question_text"] = f"Select the correct Pinyin that matches the meaning '{meaning}'."

            elif q_type == "TRUE_FALSE":
                should_be_true = random.choice([True, False])
                smart_distractors = distractors_by_idx[idx] or []
                chosen_distractor = random.choice(smart_distractors) if smart_distractors else None
                
                # VARIETY BRANCHING FOR TRUE/FALSE MODALITY
                tf_variant = random.choice(["WORD_VS_MEANING", "WORD_VS_PINYIN", "PINYIN_VS_MEANING"])
                
                if tf_variant == "WORD_VS_MEANING":
                    displayed_meaning = meaning
                    if not should_be_true:
                        matched = next((i for i in vocab_items if i.get('simplified') == chosen_distractor), None) if chosen_distractor else None
                        displayed_meaning = matched.get('meaning') if matched else random.choice(meaning_pool)
                    
                    question_data["question_text"] = f"True or False: Does the following Chinese word match its meaning?\n\nWord: {word}\nMeaning: {displayed_meaning}"
                    question_data["correct_answer"] = "TRUE" if should_be_true else "FALSE"

                elif tf_variant == "WORD_VS_PINYIN":
                    displayed_pinyin = pinyin
                    if not should_be_true:
                        matched = next((i for i in vocab_items if i.get('simplified') == chosen_distractor), None) if chosen_distractor else None
                        displayed_pinyin = matched.get('pinyin') if matched else f"{pinyin}ao"

                    question_data["question_text"] = f"True or False: Does the following Chinese word match its Pinyin?\n\nWord: {word}\nPinyin: {displayed_pinyin}"
                    question_data["correct_answer"] = "TRUE" if should_be_true else "FALSE"

                elif tf_variant == "PINYIN_VS_MEANING":
                    displayed_meaning = meaning
                    if not should_be_true:
                        matched = next((i for i in vocab_items if i.get('simplified') == chosen_distractor), None) if chosen_distractor else None
                        displayed_meaning = matched.get('meaning') if matched else random.choice(meaning_pool)

                    question_data["question_text"] = f"True or False: Does the following Pinyin match its meaning?\n\nPinyin: {pinyin}\nMeaning: {displayed_meaning}"
                    question_data["correct_answer"] = "TRUE" if should_be_true else "FALSE"
            elif q_type == "FILL_BLANK":
                question_data["correct_answer"] = word
                res = QuizTemplateEngine.create_fill_blank(context, word)
                question_data["question_text"] = res["question_text"]

            elif q_type == "SHORT_ANSWER":
                question_data["correct_answer"] = word
                
                # VARIETY BRANCHING FOR SHORT ANSWER
                sa_variant = random.choice(["TRANSLATION_PROMPT", "PINYIN_DEFINITION"])
                
                if sa_variant == "TRANSLATION_PROMPT" and translation:
                    question_data["question_text"] = f"Please write the Chinese word for the following English translation:\n“{translation}”"
                else:
                    pinyin_str = f"【{pinyin}】" if pinyin else ""
                    question_data["question_text"] = f"Please write the Chinese word that corresponds to the Pinyin {pinyin_str} and definition below:\nDefinition: {meaning}"


            questions.append(question_data)

        return questions