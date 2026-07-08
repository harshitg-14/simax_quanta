"""
Module 3 — Metadata Enrichment Engine
Gemini-powered: document analysis + Q&A
"""
import os
import json
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
_MODEL  = "gemini-2.5-flash-lite"


def _call(prompt: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            response = _client.models.generate_content(model=_MODEL, contents=prompt)
            return response.text
        except Exception as e:
            msg = str(e)
            if "503" in msg or "UNAVAILABLE" in msg or "429" in msg or "quota" in msg.lower():
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # 1s, 2s, 4s backoff
                    continue
            raise
    raise RuntimeError("Gemini API unavailable after retries")


def enrich_metadata(text: str) -> dict:
    """Module 3: extract structured metadata from document text."""
    prompt = f"""You are analyzing a government document.
Return ONLY valid JSON — no markdown, no explanation.

{{
  "summary": "2-3 sentence summary",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "doc_type": "policy|circular|notification|act|order|scheme|report|other",
  "department": "name of issuing department, empty string if unknown",
  "version": "version or amendment number, empty string if unknown",
  "issue_date": "YYYY-MM-DD, empty string if unknown",
  "effective_date": "YYYY-MM-DD, empty string if unknown",
  "classification": "public|restricted|confidential"
}}

Document (first 25000 chars):
{text[:25000]}
"""
    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        return {
            "summary":        data.get("summary", ""),
            "keywords":       ", ".join(data.get("keywords", [])),
            "doc_type":       data.get("doc_type", "other"),
            "department":     data.get("department", ""),
            "version":        data.get("version", ""),
            "issue_date":     data.get("issue_date", ""),
            "effective_date": data.get("effective_date", ""),
            "classification": data.get("classification", "public"),
        }
    except Exception as e:
        print(f"Metadata enrichment error: {e}")
        return {
            "summary": "", "keywords": "", "doc_type": "other",
            "department": "", "version": "", "issue_date": "",
            "effective_date": "", "classification": "public"
        }


def answer_question(context: str, question: str, history: str = "") -> str:
    """Answer a question grounded in document context."""
    prompt = f"""You are Simax Quanta — a Government Knowledge Intelligence assistant specializing in Indian government schemes and policies.

{"Conversation History:" + chr(10) + history if history else ""}

Document Context:
{context}

Question: {question}

Instructions:
1. Answer based on the document context provided above.
2. Synthesize and infer from the context — if the purpose, objective or description of something is described even implicitly, extract and explain it clearly.
3. Cite the relevant section heading when referencing specific content.
4. If the context contains partial information, provide what is available and note what is partial.
5. Only say "Information not found in uploaded documents." if the context has absolutely no relevant information about the topic — not just missing the exact phrase.
6. Be clear, structured and concise in your answer.
"""
    return _call(prompt)
