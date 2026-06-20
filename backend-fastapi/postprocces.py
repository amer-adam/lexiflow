import json
import time
import concurrent
from pypinyin import pinyin
from pycccedict.cccedict import CcCedict
from concurrent.futures import ThreadPoolExecutor
import threading
import re
import jieba  # Added for smart word segmentation

# Shared HSK data with lock for thread safety
hsk_data = None
hsk_lock = threading.Lock()

# Thread-local storage for CcCedict
thread_local = threading.local()


def initialize_hsk_data():
    """Load HSK data once at startup"""
    global hsk_data
    try:
        with open('./hsk.json', 'r', encoding='utf-8') as file:
            with hsk_lock:
                if hsk_data is None:
                    hsk_data = json.load(file)
    except FileNotFoundError:
        print("Error: File not found at './hsk.json'")
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in the file")


def get_cccedict():
    """Get thread-local CcCedict instance"""
    if not hasattr(thread_local, "cccedict"):
        thread_local.cccedict = CcCedict()
    return thread_local.cccedict


def get_character_data(token):
    """Thread-safe access to HSK data"""
    if hsk_data is None:
        return None

    with hsk_lock:
        for char_data in hsk_data:
            if char_data.get('hanzi') == token:
                return char_data
    return None


def process_single_segment(text):
    """
    Process a single text segment by smartly breaking down Chinese phrases,
    English words, spaces, and numbers. Falls back to character-by-character
    processing if a multi-character Chinese token has no meaning/definition.
    """
    if not text:
        return {}

    cccedict = get_cccedict()
    result = {}

    # 1. Use Jieba to tokenize into multi-char Chinese words or English chunks
    tokens = jieba.lcut(text)

    for token in tokens:
        if not token.strip():
            continue

        # 2. Check if the token is entirely English words, numbers, or standard punctuation
        if re.match(r'^[A-Za-z0-9\s!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]+$', token):
            is_num = token.isdigit()
            key = f"@{token}" if is_num else token 
            
            pinyin_list = pinyin(token, style='normal')
            pinyin_val = ' '.join([item[0] for item in pinyin_list]) if pinyin_list else token
            
            result[key] = {
                'pinyin': pinyin_val,
                'translations': ['number'] if is_num else [],
                'hsk_level': None,
                'is_phrase': not is_num,
                'is_number': is_num
            }
            continue

        # Helper function to evaluate dictionary entries
        def lookup_token(t):
            # Check HSK
            char_data = get_character_data(t)
            if char_data and char_data.get('translations'):
                return {
                    'pinyin': char_data.get('pinyin', ''),
                    'translations': char_data.get('translations', []),
                    'hsk_level': char_data.get('level', None),
                    'is_phrase': len(t) > 1,
                    'is_number': False
                }
            # Check CCCEDICT
            try:
                entry = cccedict.get_entry(t)
                if entry and entry.get('definitions'):
                    pinyin_list = pinyin(t, style='normal')
                    pinyin_val = ' '.join([item[0] for item in pinyin_list]) if pinyin_list else t
                    return {
                        'pinyin': pinyin_val,
                        'translations': entry.get('definitions', []),
                        'hsk_level': None,
                        'is_phrase': len(t) > 1,
                        'is_number': False
                    }
            except Exception:
                pass
            return None

        # 3. Try to look up the token as a whole phrase
        token_data = lookup_token(token)
        
        if token_data:
            # Found definitions for the whole phrase!
            result[token] = token_data
        else:
            # 4. FALLBACK: No definitions found for the phrase, break it down character-by-character
            if len(token) > 1:
                # Print debug log similar to yours to track fallback actions
                # print(f"[Watch Sync Fallback] Phrase '{token}' missing definitions. Splitting word-by-word.")
                
                for char in token:
                    char_data = lookup_token(char)
                    if char_data:
                        result[char] = char_data
                    else:
                        # Final ultimate fallback if even the single character isn't in your dicts
                        pinyin_list = pinyin(char, style='normal')
                        pinyin_val = pinyin_list[0][0] if pinyin_list else char
                        result[char] = {
                            'pinyin': pinyin_val,
                            'translations': [],
                            'hsk_level': None,
                            'is_phrase': False,
                            'is_number': False
                        }
            else:
                # It was already a single character phrase with no definition
                pinyin_list = pinyin(token, style='normal')
                pinyin_val = pinyin_list[0][0] if pinyin_list else token
                result[token] = {
                    'pinyin': pinyin_val,
                    'translations': [],
                    'hsk_level': None,
                    'is_phrase': False,
                    'is_number': False
                }

    return result

def api_postprocess(result, max_workers=16):
    """Post-process transcription results with multithreading"""
    if not result or "text" not in result or not result["text"]:
        return result

    # Initialize HSK data if not already loaded
    if hsk_data is None:
        print("Initializing HSK data...")
        hsk_init_start = time.time()
        initialize_hsk_data()
        print(f"HSK initialization took {time.time() - hsk_init_start:.2f}s")

    # Process segments in parallel
    print(f"Processing {len(result['segments'])} segments in parallel...")
    process_start = time.time()
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(process_single_segment, segment['text']): segment
            for segment in result['segments']
        }

        for future in concurrent.futures.as_completed(futures):
            segment = futures[future]
            try:
                segment['characters'] = future.result()
            except Exception as e:
                print(f"Error processing segment {segment['text']}: {str(e)}")
                segment['characters'] = {}
    
    print(f"Parallel processing of segments took {time.time() - process_start:.2f}s")
    
    save_start = time.time()
    with open('./result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=4)
    print(f"Saving results to JSON took {time.time() - save_start:.2f}s")
    return result