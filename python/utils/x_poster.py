import os
import tweepy
from dotenv import load_dotenv

load_dotenv()


def _client() -> tweepy.Client:
    return tweepy.Client(
        consumer_key=os.environ["X_CONSUMER_KEY"],
        consumer_secret=os.environ["X_CONSUMER_SECRET"],
        access_token=os.environ["X_ACCESS_TOKEN"],
        access_token_secret=os.environ["X_ACCESS_TOKEN_SECRET"],
    )


def post_tweet(text: str) -> bool:
    try:
        _client().create_tweet(text=text)
        print(f"[x] posted ({len(text)} chars): {text[:60]}...")
        return True
    except Exception as e:
        print(f"[x] failed: {e}")
        return False
