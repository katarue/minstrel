import io
import os

import requests
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


def _api() -> tweepy.API:
    """メディアアップロード用の v1.1 API クライアント。"""
    auth = tweepy.OAuth1UserHandler(
        consumer_key=os.environ["X_CONSUMER_KEY"],
        consumer_secret=os.environ["X_CONSUMER_SECRET"],
        access_token=os.environ["X_ACCESS_TOKEN"],
        access_token_secret=os.environ["X_ACCESS_TOKEN_SECRET"],
    )
    return tweepy.API(auth)


def post_tweet(text: str) -> bool:
    try:
        _client().create_tweet(text=text)
        print(f"[x] posted ({len(text)} chars): {text[:60]}...")
        return True
    except Exception as e:
        print(f"[x] failed: {e}")
        return False


def post_tweet_with_image(text: str, image_url: str) -> bool:
    """
    画像付きツイートを投稿する。
    画像取得またはアップロードに失敗した場合はテキストのみで投稿する。
    """
    try:
        resp = requests.get(image_url, timeout=15)
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "image/jpeg")
        if "png" in content_type:
            filename = "image.png"
        elif "gif" in content_type:
            filename = "image.gif"
        else:
            filename = "image.jpg"

        media = _api().media_upload(filename=filename, file=io.BytesIO(resp.content))
        _client().create_tweet(text=text, media_ids=[media.media_id])
        print(f"[x] posted with image ({len(text)} chars): {text[:60]}...")
        return True

    except Exception as e:
        print(f"[x] image upload failed, falling back to text-only: {e}")
        return post_tweet(text)
