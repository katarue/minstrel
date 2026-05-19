import io
import os
from dataclasses import dataclass

import requests
import tweepy
from dotenv import load_dotenv

load_dotenv()


@dataclass
class PostResult:
    success: bool
    tweet_id: str | None = None
    tweet_url: str | None = None
    error: str | None = None


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


def post_tweet_v2(text: str, image_urls: list[str] | None = None) -> PostResult:
    """
    統合投稿関数。tweet_id を含む PostResult を返す。
    image_urls は最大4件。画像アップロード失敗時はスキップしてテキストのみで投稿する。
    """
    try:
        media_ids: list[int] = []
        if image_urls:
            api = _api()
            for url in image_urls[:4]:
                try:
                    resp = requests.get(url, timeout=15)
                    resp.raise_for_status()
                    ct = resp.headers.get("Content-Type", "image/jpeg")
                    ext = "png" if "png" in ct else "gif" if "gif" in ct else "jpg"
                    media = api.media_upload(filename=f"image.{ext}", file=io.BytesIO(resp.content))
                    media_ids.append(media.media_id)
                except Exception as e:
                    print(f"[x] image upload skipped ({url[:60]}): {e}")

        kwargs: dict = {"text": text}
        if media_ids:
            kwargs["media_ids"] = media_ids

        response = _client().create_tweet(**kwargs)
        tweet_id = str(response.data["id"])
        tweet_url = f"https://x.com/i/status/{tweet_id}"
        print(f"[x] posted ({len(text)} chars): {text[:60]}...")
        return PostResult(success=True, tweet_id=tweet_id, tweet_url=tweet_url)

    except tweepy.errors.TweepyException as e:
        codes = getattr(e, "api_codes", None)
        msgs = getattr(e, "api_messages", None)
        detail = f"{e}"
        if codes:
            detail += f" [codes={codes}]"
        if msgs:
            detail += f" [api_msgs={msgs}]"
        print(f"[x] failed: {detail}")
        return PostResult(success=False, error=detail)
    except Exception as e:
        print(f"[x] failed (unexpected): {e}")
        return PostResult(success=False, error=str(e))


def post_tweet(text: str) -> bool:
    """テキストのみ投稿。flow_post_weekly.py との後方互換。"""
    return post_tweet_v2(text).success


def post_tweet_with_image(text: str, image_url: str) -> bool:
    """
    画像付きツイートを投稿する。
    画像取得またはアップロードに失敗した場合はテキストのみで投稿する。
    flow_post_weekly.py との後方互換。
    """
    return post_tweet_v2(text, [image_url]).success
