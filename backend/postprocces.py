import json
import concurrent
from pypinyin import pinyin
from pycccedict.cccedict import CcCedict
from concurrent.futures import ThreadPoolExecutor
import threading
import re

# Shared HSK data with lock for thread safety
hsk_data = None
hsk_lock = threading.Lock()

# Thread-local storage for CcCedict
thread_local = threading.local()


def initialize_hsk_data():
    """Load HSK data once at startup"""
    global hsk_data
    try:
        with open('/home/amer/lexiflow/backend/hsk.json', 'r', encoding='utf-8') as file:
            with hsk_lock:
                if hsk_data is None:
                    hsk_data = json.load(file)
    except FileNotFoundError:
        print(f"Error: File not found at '/home/amer/lexiflow/backend/hsk.json'")
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in the file")


def get_cccedict():
    """Get thread-local CcCedict instance"""
    if not hasattr(thread_local, "cccedict"):
        thread_local.cccedict = CcCedict()
    return thread_local.cccedict


def get_character_data(character):
    """Thread-safe access to HSK data"""
    if hsk_data is None:
        return None

    with hsk_lock:
        for char_data in hsk_data:
            if char_data.get('hanzi') == character:
                return char_data
    return None


def process_single_segment(text, max_phrase_length=3):
    """Process a single text segment with number detection"""
    if not text:
        return {}

    # First check for numbers in the text
    number_match = re.search(r'\d+', text)
    if number_match:
        number_str = number_match.group()
        start_idx = number_match.start()
        end_idx = number_match.end()

        # Process the part before the number
        result = {}
        if start_idx > 0:
            result.update(process_single_segment(text[:start_idx], max_phrase_length))

        # Add the number entry
        result['@'+number_str] = {
            'pinyin': ' '.join(pinyin(number_str, style='normal')[0]),
            'translations': ['number'],
            'hsk_level': None,
            'is_phrase': False,
            'is_number': True
        }

        # Process the part after the number
        if end_idx < len(text):
            result.update(process_single_segment(text[end_idx:], max_phrase_length))
        return result

    cccedict = get_cccedict()

    # Original phrase processing logic
    current_length = min(max_phrase_length, len(text))
    while current_length > 0:
        current_phrase = text[:current_length]
        char_data = get_character_data(current_phrase)

        if char_data:
            result = {
                current_phrase: {
                    'pinyin': char_data.get('pinyin', []),
                    'translations': char_data.get('translations', []),
                    'hsk_level': char_data.get('level', None),
                    'is_phrase': current_length > 1,
                    'is_number': False
                }
            }

            remaining_text = text[current_length:]
            if remaining_text:
                result.update(process_single_segment(remaining_text, max_phrase_length))
            return result

        current_length -= 1

    # Fallback to single character processing
    single_char = text[0]
    char_data = get_character_data(single_char)

    if char_data:
        result = {
            single_char: {
                'pinyin': char_data.get('pinyin', []),
                'translations': char_data.get('translations', []),
                'hsk_level': char_data.get('level', None),
                'is_phrase': False,
                'is_number': False
            }
        }
    else:
        try:
            result = {
                single_char: {
                    'pinyin': pinyin(single_char, style='normal')[0][0],
                    'translations': cccedict.get_entry(single_char).get('definitions', []),
                    'hsk_level': None,
                    'is_phrase': False
                }
            }
        except Exception as e:
            print(f"Error processing character '{single_char}': {str(e)}")
            result = {'@'+single_char: {'pinyin': single_char, 'translations': [], 'hsk_level': None, 'is_phrase': False}}

    remaining_text = text[1:]
    if remaining_text:
        result.update(process_single_segment(remaining_text, max_phrase_length))
    return result


def api_postprocess(result, max_workers=16):
    """Post-process transcription results with multithreading"""
    if not result or "text" not in result or not result["text"]:
        return result

    # Initialize HSK data if not already loaded
    if hsk_data is None:
        initialize_hsk_data()

    # Process segments in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(process_single_segment, segment['text']): segment
            for segment in result['segments']
        }

        for future in concurrent.futures.as_completed(futures):
            segment = futures[future]
            try:
                segment['characters'] = future.result()
                print(f"Processed segment: {segment['text']}")
            except Exception as e:
                print(f"Error processing segment {segment['text']}: {str(e)}")
                segment['characters'] = {}
    json.dump(result, open('/home/amer/lexiflow/backend/result.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
    return result
