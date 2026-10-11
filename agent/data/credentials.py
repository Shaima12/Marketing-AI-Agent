import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from agent.config.settings import CREDENTIALS_KEY

def decrypt(payload: str) -> str:
    iv, tag, data = [base64.b64decode(p) for p in payload.split(".")]
    key = base64.b64decode(CREDENTIALS_KEY)
    return AESGCM(key).decrypt(iv, data + tag, None).decode()