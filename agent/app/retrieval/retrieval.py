"""Final retrieval pipeline: rewrites -> Pinecone search -> fuse by (chapter, section) -> Jina rerank."""
import os, re, json, time, requests, numpy as np
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pinecone import Pinecone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ---------------- config ----------------
JINA_URL     = "https://api.jina.ai/v1/embeddings"
JINA_MODEL   = "jina-embeddings-v5-text-small"
EMBED_DIM    = 1024
INDEX_NAME   = "marketing-kb-jina"
MD_NAMESPACE = "handbook-md-jina-v5-small"
RERANK_MODEL = "jina-reranker-v2-base-multilingual"
GROQ_MODEL   = "openai/gpt-oss-20b"                  # only used to write the rewrites
EXP_PATH     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expansions_cache.json")

JH = {"Authorization": f"Bearer {os.environ['JINA_API_KEY']}", "Content-Type": "application/json"}
GH = {"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}", "Content-Type": "application/json"}
index = Pinecone(api_key=os.environ["PINECONE_API_KEY"]).Index(INDEX_NAME)


# ---------------- helpers ----------------
def _post(url, headers, payload, tries=5):
    for a in range(tries):
        r = requests.post(url, headers=headers, json=payload, timeout=120)
        if r.status_code not in (429, 500, 502, 503):
            break
        time.sleep(3 * (a + 1))
    r.raise_for_status()
    return r.json()

def jina_embed(texts, task, batch=32):
    out = []
    for i in range(0, len(texts), batch):
        d = _post(JINA_URL, JH, {"model": JINA_MODEL, "input": texts[i:i + batch],
                                 "dimensions": EMBED_DIM, "task": task})
        out += [x["embedding"] for x in sorted(d["data"], key=lambda x: x["index"])]
    return np.asarray(out, dtype=np.float32)

def rerank(query, docs, top_n):
    """Returns [(doc_index, score), ...] best first."""
    d = _post("https://api.jina.ai/v1/rerank", JH,
              {"model": RERANK_MODEL, "query": query, "documents": docs, "top_n": top_n})
    res = sorted(d["results"], key=lambda x: -x["relevance_score"])
    return [(x["index"], x["relevance_score"]) for x in res]

def groq_chat(model, prompt, max_tokens=1500):
    d = _post("https://api.groq.com/openai/v1/chat/completions", GH,
              {"model": model, "temperature": 0, "max_tokens": max_tokens,
               "messages": [{"role": "user", "content": prompt}]})
    return d["choices"][0]["message"]["content"]


# ---------------- step 1: rewrites ----------------
_exp = json.load(open(EXP_PATH, encoding="utf-8")) if os.path.exists(EXP_PATH) else {}

def expand(question, n=3):
    """[original question] + n rewrites. Cached on disk so the same question always gives the same results."""
    if question in _exp:
        return _exp[question]
    prompt = (f"Rewrite this question into {n} short search queries for a handbook on digital "
              "marketing and e-commerce analytics. Use concrete analytical vocabulary (metrics, "
              "definitions, methods, trade-offs) that a relevant section would contain. "
              "Cover different angles. Return ONLY a JSON list of strings.\n\n"
              f"Question: {question}")
    try:
        m = re.search(r"\[.*\]", groq_chat(GROQ_MODEL, prompt), re.S)
        _exp[question] = [question] + [str(x) for x in json.loads(m.group(0))[:n]]
        json.dump(_exp, open(EXP_PATH, "w", encoding="utf-8"), indent=1)
        return _exp[question]
    except Exception as e:
        print("expand failed, using the original question only:", str(e)[:100])
        return [question]


# ---------------- steps 2-4: search, group by section, rerank ----------------
def is_body(md):
    """Real sections only (skips glossary, preface and chapter intros)."""
    return str(md.get("chapter") or "").startswith("Chapter") and bool(md.get("section"))

def full_section_text(chapter, section, qvec):
    ms = index.query(namespace=MD_NAMESPACE, vector=qvec, top_k=20, include_metadata=True,
                     filter={"chapter": {"$eq": chapter}, "section": {"$eq": section}})["matches"]
    return "\n\n".join(t for _, t in sorted((m["metadata"].get("ordinal", 0), m["metadata"]["text"]) for m in ms))

def retrieve(question, queries=None, top_sections=25, pool=40, per_query=40, rrf_k=60, complete=True):
    """Returns [{'chapter','section','text','score'}, ...] best first.
    queries: pass the saved rewrites to skip the LLM call.
    complete: after ranking, fetch every chunk of each returned section (changes text only, never the ranking)."""
    queries = queries or expand(question)
    weights = [2.0] + [1.0] * (len(queries) - 1)           # the original question counts double
    qv = jina_embed(queries, "retrieval.query")

    chunks, score = defaultdict(dict), {}                  # (chapter, section) -> {chunk id: (ordinal, text)}
    for v, w in zip(qv, weights):
        ms = index.query(namespace=MD_NAMESPACE, vector=v.tolist(), top_k=per_query, include_metadata=True)["matches"]
        seen, rank = set(), 0
        for m in ms:
            md = m["metadata"]
            if not is_body(md):
                continue
            key = (md["chapter"], md["section"])
            chunks[key][m["id"]] = (md.get("ordinal", 0), md["text"])
            if key in seen:
                continue
            seen.add(key); rank += 1
            score[key] = score.get(key, 0) + w / (rrf_k + rank)   # reciprocal rank fusion

    cand = sorted(score, key=score.get, reverse=True)[:pool]
    text_of = {k: "\n\n".join(t for _, t in sorted(chunks[k].values())) for k in cand}
    docs = [f"{k[0]} > {k[1]}\n{text_of[k]}"[:2500] for k in cand]

    rr = {}
    try:
        ranked = rerank(question, docs, min(top_sections, len(cand)))
        rr = {cand[i]: s for i, s in ranked}
        cand = [cand[i] for i, _ in ranked]
    except Exception as e:
        print("rerank failed, keeping fusion order:", str(e)[:100])
    cand = cand[:top_sections]

    if complete:
        with ThreadPoolExecutor(8) as ex:
            full = list(ex.map(lambda k: full_section_text(k[0], k[1], qv[0].tolist()), cand))
        text_of.update({k: t for k, t in zip(cand, full) if t})
    return [{"chapter": k[0], "section": k[1], "text": text_of[k], "score": rr.get(k)} for k in cand]


# ---------------- tools for the agent (used later) ----------------
def search_handbook(query, top_sections=25):
    return [{"chapter": s["chapter"], "section": s["section"], "score": s["score"],
             "is_invented_example": "Worked Example" in s["section"], "text": s["text"]}
            for s in retrieve(query, top_sections=top_sections)]

def list_sections(chapter):
    v = jina_embed([chapter], "retrieval.query")[0].tolist()
    ms = index.query(namespace=MD_NAMESPACE, vector=v, top_k=100, include_metadata=True,
                     filter={"chapter": {"$eq": chapter}})["matches"]
    return [s for _, s in sorted({(m["metadata"].get("ordinal", 0), m["metadata"]["section"]) for m in ms})]

def get_section(chapter, section):
    v = jina_embed([f"{chapter} {section}"], "retrieval.query")[0].tolist()
    return full_section_text(chapter, section, v)