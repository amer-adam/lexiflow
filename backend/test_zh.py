url = "http://127.0.0.1:5000/translate"
import json
import requests
from pypinyin import pinyin
from pycccedict.cccedict import CcCedict



cccedict = CcCedict()

# josn_data = '/home/amer/lexiflow/backend/temp/TeaTime News 茶歇新闻 ｜ 2024年12月20日： 习近平去澳门，退休年龄，死刑 [7v2BMJvUhOk].webm-result.json'
josn_data = '/home/amer/lexiflow/backend/translated_result.json'
with open(josn_data, "r") as f:
    results = json.load(f)

def get_character_data(character, ):
    """
    Search for a Chinese character in a JSON file and return its data.
    
    Args:
        character (str): The Chinese character to search for (e.g., "爱")
        json_file_path (str): Path to the JSON file containing character data
    
    Returns:
        dict: Dictionary containing character data if found, None otherwise
    """
    try:
        with open('/home/amer/lexiflow/backend/hsk.json', 'r', encoding='utf-8') as file:
            # Load all characters (assuming the file contains a list of character objects)
            characters = json.load(file)
            
            # Search for the character
            for char_data in characters:
                if char_data.get('hanzi') == character:
                    return char_data
            
            # If character not found
            return None
            
    except FileNotFoundError:
        print(f"Error: File not found at '/home/amer/lexiflow/backend/hsk.json'")
        return None
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in the file")
        return None


def convert_segment(text, max_phrase_length=3):
    """
    Recursively convert a Chinese text segment into character/word data.
    Checks for phrases up to max_phrase_length characters before falling back to shorter combinations.
    
    Args:
        text (str): Chinese text to convert
        max_phrase_length (int): Maximum phrase length to check (default 3)
    
    Returns:
        dict: Dictionary with character/phrase data including pinyin, translations, and HSK level
    """
    if not text:
        return {}
    
    # Try to find the longest possible phrase first
    current_length = min(max_phrase_length, len(text))
    while current_length > 0:
        current_phrase = text[:current_length]
        char_data = get_character_data(current_phrase)
        
        if char_data:
            # Found a match for this phrase length
            result = {
                current_phrase: {
                    'pinyin': char_data.get('pinyin', []),
                    'translations': char_data.get('translations', []),
                    'hsk_level': char_data.get('level', None),
                    'is_phrase': current_length > 1
                }
            }
            
            # Recursively process the remaining text
            remaining_text = text[current_length:]
            if remaining_text:
                result.update(convert_segment(remaining_text, max_phrase_length))
            return result
        
        current_length -= 1
    
    # If no multi-character phrase found, try single character with fallback
    single_char = text[0]
    char_data = get_character_data(single_char)
    
    if char_data:
        result = {
            single_char: {
                'pinyin': char_data.get('pinyin', []),
                'translations': char_data.get('translations', []),
                'hsk_level': char_data.get('level', None),
                'is_phrase': False
            }
        }
    else:
        # Fallback to dictionary/pinyin lookup
        result = {
            single_char: {
                'pinyin': pinyin(single_char, style='normal')[0][0] if 'pinyin' in globals() else '',
                'translations': cccedict.get_entry(single_char).get('definitions', []) if 'cccedict' in globals() else [],
                'hsk_level': None,
                'is_phrase': False
            }
        }
    
    # Recursively process the remaining text
    remaining_text = text[1:]
    if remaining_text:
        result.update(convert_segment(remaining_text, max_phrase_length))
    return result

# source_language = 'cmn'
# text = "这是啥 我在刘大龙枕头底下发现的 上面还画着饮料的标识 芮芮 你用啥搅咖啡的 搅拌棒啊 搅拌棒 你从哪拿的 从你枕头底下啊 我枕头底下啊 一个败家娘们 这不是搅拌棒啊 这不是搅拌棒 这是啥 你自己拿出来看看 咋画了 这是啥"
# text = results['text']

# url = "http://127.0.0.1:5000/translate"
# lang_url = "http://127.0.1:5000/languages"

# response = requests.get(lang_url)

# languages = response.json()

# print("Available languages:")
# for lang in languages:
#     print(f"{lang['code']}: {lang['name']}")


# textArray = [segment['text'] for segment in results['segments']]
# 
# jsonText = json.dumps(textArray, ensure_ascii=False)
# print(jsonText)

# print(textArray)
#     ans  = cccedict.get_entry("你")
#     print(ans)

for segment in results['segments']:
    text = segment['text']
    segment['characters'] = convert_segment(text)

json.dump(results, open("pinyin_result.json", "w", encoding="utf-8"), ensure_ascii=False, indent=4)

    # break
#     text = json.dumps(text, ensure_ascii=False)

#     payload = {
#         "q": text,
#         "source": "zh",
#         "target": "en"
#     }
#     headers = {"Content-Type": "application/json"}

#     response = requests.post(url, json=payload, headers=headers)


#     print(response.status_code)
#     print(response.json())


# from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
# import torch
# from tqdm import tqdm

# tokenizer = AutoTokenizer.from_pretrained(
#         "facebook/nllb-200-distilled-600M",  src_lang="eng_Latn")
    
# print("Loading model")
# model = AutoModelForSeq2SeqLM.from_pretrained("ychenNLP/nllb-200-distilled-1.3b-easyproject")
# model.cuda()

# input_chunks = ["A translator always risks inadvertently introducing source-language words, grammar, or syntax into the target-language rendering."]
# print("Start translation...")
# output_result = []

# batch_size = 1
# for idx in tqdm(range(0, len(input_chunks), batch_size)):
#     start_idx = idx
#     end_idx = idx + batch_size
#     inputs = tokenizer(input_chunks[start_idx: end_idx], padding=True, truncation=True, max_length=128, return_tensors="pt").to('cuda')

#     with torch.no_grad():
#         translated_tokens = model.generate(**inputs, forced_bos_token_id=tokenizer.convert_tokens_to_ids("zho_Hans"), 
#                         max_length=128, num_beams=5, num_return_sequences=1, early_stopping=True)

#     output = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)
#     output_result.extend(output)
# print(output_result)






# from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

# tokenizer = AutoTokenizer.from_pretrained(
#         "facebook/nllb-200-distilled-600M",  src_lang="zho_Hans", tgt_lang="eng_Latn")
    
# print("Loading model")
# model = AutoModelForSeq2SeqLM.from_pretrained("facebook/nllb-200-distilled-600M")
# model.cuda()

# text = "这是啥 我在刘大龙枕头底下发现的 上面还画着饮料的标识 芮芮 你用啥搅咖啡的 搅拌棒啊 搅拌棒 你从哪拿的 从你枕头底下啊 我枕头底下啊 一个败家娘们 这不是搅拌棒啊 这不是搅拌棒 这是啥 你自己拿出来看看 咋画了 这是啥"

# sentences = text.split(' ')


# for article in sentences:
#     inputs = tokenizer(article, return_tensors="pt").to('cuda')
#     print(article)
#     # print(inputs)
    
#     # Access the 'input_ids' tensor from the 'inputs' dictionary
#     translated_tokens = model.generate(
#         inputs['input_ids'],  # Pass the tensor to model.generate()
#         forced_bos_token_id=tokenizer.convert_tokens_to_ids("eng_Latn"),
#         max_length=512
#     )
#     # print(tokenizer.convert_tokens_to_ids("eng_Latn"))

#     output = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True, model_max_length=512)[0]

#     # print(output)
#     print("Translated text:", output)