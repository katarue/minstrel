/**
 * Amazon Product Advertising API v5 クライアント（Japan向け）
 * Amazon 公式サンプルコードと同じ SigV4 署名ロジックを使用。
 * https://webservices.amazon.co.jp/paapi5/documentation/sending-request.html
 */
import crypto from "node:crypto";
import https from "node:https";

const HOST    = "webservices.amazon.co.jp";
const PATH    = "/paapi5/searchitems";
const TARGET  = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const SERVICE = "ProductAdvertisingAPI";
const REGION  = "us-east-1";
const ALGORITHM = "AWS4-HMAC-SHA256";

type PaApiRawItem = {
  ASIN?: string;
  ItemInfo?: { Title?: { DisplayValue?: string } };
  Images?: { Primary?: { Large?: { URL?: string } } };
};

export type AmazonItem = {
  asin: string;
  title: string;
  imageUrl: string | null;
  affiliateUrl: string;
};

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSignatureKey(secretKey: string, dateStamp: string): Buffer {
  const kDate    = hmac("AWS4" + secretKey, dateStamp);
  const kRegion  = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function buildAuthHeader(
  accessKey: string,
  secretKey: string,
  amzDate: string,
  dateStamp: string,
  body: string
): { authorization: string; xAmzDate: string } {
  const payloadHash = sha256(body);

  // ヘッダーはアルファベット順（小文字）で固定
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${TARGET}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    PATH,
    "",                 // canonical query string（なし）
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(secretKey, dateStamp);
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const authorization =
    `${ALGORITHM} Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, xAmzDate: amzDate };
}

function httpsPost(
  hostname: string,
  path: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "POST", headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
    req.write(body, "utf8");
    req.end();
  });
}

export async function searchAmazonSoundtrack(
  gameTitle: string,
  accessKey: string,
  secretKey: string,
  partnerTag: string
): Promise<AmazonItem[]> {
  const body = JSON.stringify({
    Keywords: `${gameTitle} サウンドトラック`,
    Resources: ["Images.Primary.Large", "ItemInfo.Title", "DetailPageURL"],
    SearchIndex: "Music",
    ItemCount: 5,
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: "www.amazon.co.jp",
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const { authorization, xAmzDate } = buildAuthHeader(
    accessKey, secretKey, amzDate, dateStamp, body
  );

  const headers: Record<string, string> = {
    "Content-Encoding": "amz-1.0",
    "Content-Type":     "application/json; charset=utf-8",
    "Host":             HOST,
    "X-Amz-Date":      xAmzDate,
    "X-Amz-Target":    TARGET,
    "Authorization":    authorization,
  };

  const responseText = await httpsPost(HOST, PATH, headers, body);

  let parsed: {
    SearchResult?: { Items?: PaApiRawItem[] };
    __type?: string;
    Errors?: { Code: string; Message: string }[];
  };
  try {
    parsed = JSON.parse(responseText) as typeof parsed;
  } catch {
    throw new Error(`PA API parse error: ${responseText.slice(0, 300)}`);
  }

  if (parsed.__type?.includes("Exception") || parsed.Errors) {
    const msg = parsed.Errors?.[0]?.Message ?? parsed.__type ?? "Unknown error";
    throw new Error(`PA API error: ${msg}`);
  }

  const items = parsed?.SearchResult?.Items ?? [];

  return items.map((item) => ({
    asin:         item.ASIN ?? "",
    title:        item.ItemInfo?.Title?.DisplayValue ?? "",
    imageUrl:     item.Images?.Primary?.Large?.URL ?? null,
    affiliateUrl: `https://www.amazon.co.jp/dp/${item.ASIN}?tag=${partnerTag}`,
  }));
}
