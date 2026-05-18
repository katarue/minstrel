/**
 * Amazon Product Advertising API v5 クライアント（Japan向け）
 * AWS Signature Version 4 で署名してリクエストを送る。
 */
import crypto from "crypto";

const REGION = "us-east-1";
const SERVICE = "ProductAdvertisingAPI";
const HOST = "webservices.amazon.co.jp";
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;
const AMZTARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function signingKey(secretKey: string, dateStamp: string): Buffer {
  const kDate    = hmac("AWS4" + secretKey, dateStamp);
  const kRegion  = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

export type AmazonItem = {
  asin: string;
  title: string;
  imageUrl: string | null;
  affiliateUrl: string;
};

export async function searchAmazonSoundtrack(
  gameTitle: string,
  accessKey: string,
  secretKey: string,
  partnerTag: string
): Promise<AmazonItem[]> {
  const keywords = `${gameTitle} サウンドトラック`;

  const now = new Date();
  // amzDate: 20260518T120000Z
  const amzDate =
    now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "").replace("Z", "") + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const body = JSON.stringify({
    Keywords: keywords,
    Resources: ["Images.Primary.Large", "ItemInfo.Title", "DetailPageURL"],
    SearchIndex: "Music",
    ItemCount: 5,
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: "www.amazon.co.jp",
  });

  const bodyHash = sha256hex(body);

  // ヘッダーはアルファベット順に並べること（SigV4要件）
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${AMZTARGET}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    "/paapi5/searchitems",
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const signature = hmac(signingKey(secretKey, dateStamp), stringToSign).toString("hex");
  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Encoding": "amz-1.0",
      "Content-Type": "application/json; charset=utf-8",
      Host: HOST,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": AMZTARGET,
      Authorization: authHeader,
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PA API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const items: unknown[] = data?.SearchResult?.Items ?? [];

  return items.map((item: any) => ({
    asin: item.ASIN ?? "",
    title: item.ItemInfo?.Title?.DisplayValue ?? "",
    imageUrl: item.Images?.Primary?.Large?.URL ?? null,
    affiliateUrl: `https://www.amazon.co.jp/dp/${item.ASIN}?tag=${partnerTag}`,
  }));
}
