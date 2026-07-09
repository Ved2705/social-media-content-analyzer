import os
import re
import base64
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_VISION_MODEL = "qwen/qwen3.6-27b"

# Rough per-platform ideal caption lengths (characters), used for heuristic tips
PLATFORM_LIMITS = {
    "twitter": 280,
    "instagram": 2200,
    "linkedin": 3000,
    "facebook": 63206,
}

CTA_KEYWORDS = [
    "comment", "share", "tag", "follow", "click", "link in bio", "dm",
    "subscribe", "save this", "let us know", "swipe", "shop now",
    "sign up", "learn more", "check out",
]

HASHTAG_PATTERN = re.compile(r"#\w+")
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "]+",
    flags=re.UNICODE,
)


def _count_words(text: str) -> int:
    return len(text.split())


def _flesch_reading_ease(text: str) -> float | None:
    """Lightweight Flesch Reading Ease approximation (no external deps)."""
    sentences = max(len(re.findall(r"[.!?]+", text)), 1)
    words = re.findall(r"[A-Za-z']+", text)
    if not words:
        return None
    syllable_count = sum(_count_syllables(w) for w in words)
    words_count = len(words)
    score = (
        206.835
        - 1.015 * (words_count / sentences)
        - 84.6 * (syllable_count / words_count)
    )
    return round(score, 1)


def _count_syllables(word: str) -> int:
    word = word.lower()
    vowels = "aeiouy"
    count = 0
    prev_was_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_was_vowel:
            count += 1
        prev_was_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def rule_based_analysis(text: str) -> dict:
    char_count = len(text)
    word_count = _count_words(text)
    hashtags = HASHTAG_PATTERN.findall(text)
    emojis = EMOJI_PATTERN.findall(text)
    has_cta = any(kw in text.lower() for kw in CTA_KEYWORDS)
    readability = _flesch_reading_ease(text)

    tips = []

    if word_count < 10:
        tips.append("Your caption is very short — consider adding more context or a hook to draw readers in.")
    elif word_count > 150:
        tips.append("Your caption is quite long. Long-form works on LinkedIn/Facebook, but consider trimming for Instagram/Twitter.")

    if len(hashtags) == 0:
        tips.append("No hashtags found. Adding 3-5 relevant hashtags can meaningfully increase discoverability.")
    elif len(hashtags) > 15:
        tips.append("You're using a lot of hashtags — platforms like Instagram cap effectiveness around 8-15; too many can look spammy.")

    if len(emojis) == 0:
        tips.append("Consider adding 1-2 emojis to increase visual engagement and warmth.")

    if not has_cta:
        tips.append("No clear call-to-action detected. Try prompting readers to comment, share, or click a link.")

    if readability is not None and readability < 40:
        tips.append("Readability score is low — try shorter sentences and simpler words for a broader audience.")

    platform_notes = {}
    for platform, limit in PLATFORM_LIMITS.items():
        platform_notes[platform] = {
            "within_limit": char_count <= limit,
            "limit": limit,
        }

    return {
        "char_count": char_count,
        "word_count": word_count,
        "hashtag_count": len(hashtags),
        "hashtags_found": hashtags,
        "emoji_count": len(emojis),
        "has_call_to_action": has_cta,
        "readability_score": readability,
        "platform_fit": platform_notes,
        "rule_based_tips": tips,
    }


def ai_suggestions(text: str) -> dict:
    """Calls Groq's free-tier LLM to generate natural-language engagement
    suggestions. Gracefully degrades if no API key is configured."""
    if not GROQ_API_KEY:
        return {
            "available": False,
            "message": "AI suggestions disabled: set GROQ_API_KEY in your .env to enable this feature (free tier at console.groq.com).",
        }

    client = Groq(api_key=GROQ_API_KEY)

    prompt = f"""You are a social media strategist. Analyze the following post and give concise, actionable engagement improvement suggestions.

Post:
\"\"\"{text}\"\"\"

Respond ONLY with a JSON object in this exact shape, no extra commentary:
{{
  "tone": "<one or two words describing the current tone>",
  "suggested_hashtags": ["<up to 5 relevant hashtags, without the # symbol>"],
  "improvement_suggestions": ["<3-5 short, specific, actionable suggestions>"],
  "rewritten_hook": "<one improved opening line/hook for this post>"
}}"""

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500,
        )
        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()

        import json
        parsed = json.loads(content)
        parsed["available"] = True
        return parsed
    except Exception as e:
        return {"available": False, "message": f"AI suggestion generation failed: {str(e)}"}


def analyze_image_failure(image_bytes: bytes) -> str:
    """Uses Groq Vision model to exactly analyze why an image failed text extraction."""
    if not GROQ_API_KEY:
        return "Cannot provide exact visual reason: Groq API key is missing."
    
    client = Groq(api_key=GROQ_API_KEY)
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    
    prompt = "Look at this image. Tell me exactly what it is in one simple, conversational sentence, explaining why there is no text to read. For example: 'There is no text here, it's just a picture of a woman in a white shirt.' or 'The image is completely blank white.' Do not include any robotic analysis steps, bullet points, or preamble. Just give the final, natural human-like explanation."
    
    try:
        response = client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.3,
            max_tokens=1500,
        )
        content = response.choices[0].message.content.strip()
        # Remove reasoning block if the model uses <think> tags
        if '</think>' in content:
            content = content.split('</think>')[-1].strip()
        elif content.startswith('<think>'):
            # It cut off before finishing the thought. Return a generic error instead of the raw thought.
            return "The image appears to contain no readable text."
        return content
    except Exception as e:
        return f"Failed to analyze image visually: {str(e)}"


def analyze_post(text: str) -> dict:
    return {
        "rule_based": rule_based_analysis(text),
        "ai": ai_suggestions(text),
    }
