import os
from typing import Optional, Union
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.language_models.chat_models import BaseChatModel

# Load environment variables from the current working directory (userData in production)
env_path = os.path.join(os.getcwd(), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
else:
    # Fallback to default behavior
    load_dotenv()

def get_llm(model_name: str = None, temperature: float = 0.0) -> BaseChatModel:
    """
    Returns a configured Chat Model instance.
    Supports OpenAI (gpt-*) and Google (gemini-*).
    Uses environment variables for API keys.
    If model_name is None, uses DEFAULT_MODEL from .env (defaults to gemini-2.0-flash).
    """
    
    if model_name is None:
        model_name = os.getenv("DEFAULT_MODEL", "gemini-2.0-flash")
    
    print(f"Initializing LLM: {model_name} (temp={temperature})", flush=True)
    
    if "gemini" in model_name.lower():
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("⚠ GOOGLE_API_KEY not set. Falling back to OpenAI gpt-4o-mini...")
            model_name = "gpt-4o-mini"
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("No API keys configured. Set GOOGLE_API_KEY or OPENAI_API_KEY in .env")
            return ChatOpenAI(
                model=model_name,
                temperature=temperature,
                openai_api_key=api_key
            )
        
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=api_key
        )
        
    else:
        # Default to OpenAI for everything else
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables.")

        return ChatOpenAI(
            model=model_name,
            temperature=temperature,
            openai_api_key=api_key
        )

def ensure_directory(path: str):
    """Ensures a directory exists."""
    if not os.path.exists(path):
        os.makedirs(path)

import logging
import time
import random
from langchain_core.runnables import Runnable

logger = logging.getLogger(__name__)

def invoke_with_retry(chain: Runnable, input_data: dict, max_retries: int = 5, base_delay: int = 10):
    """
    Invokes a LangChain runnable with robust exponential backoff for rate limits.
    Specifically designed for Geminia/OpenAI 429 errors.
    """
    retries = 0
    while True:
        try:
            return chain.invoke(input_data)
        except Exception as e:
            error_msg = str(e).lower()
            # Explicitly print the error so it shows up in Electron logs
            print(f"LLM Error: {error_msg[:200]}...", flush=True)
            
            if "429" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg:
                retries += 1
                if retries > max_retries:
                    print(f"Max retries ({max_retries}) exceeded.", flush=True)
                    raise e
                
                # Check if there is a specific retry delay in the error message
                # Gemini often says "Please retry in 57.20s"
                wait_time = base_delay * (2 ** (retries - 1)) + random.uniform(0, 1)
                
                import re
                match = re.search(r"retry in (\d+(\.\d+)?)s", error_msg)
                if match:
                    wait_time = float(match.group(1)) + 1 # Add buffer
                
                retry_msg = f"⚠ Rate limited (429). Retrying in {wait_time:.2f}s... (Attempt {retries}/{max_retries})"
                print(retry_msg, flush=True)
                logger.warning(retry_msg)
                time.sleep(wait_time)
            else:
                raise e
