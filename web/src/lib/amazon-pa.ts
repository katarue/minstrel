/**
 * Amazon Product Advertising API v5 クライアント（Japan向け）
 * Node.js https モジュールで直接リクエストを送り、fetch の加工を回避する。
 */
import aws4 from "aws4";
import https from "node:https";

const HOST    = "webservices.amazon.co.jp";
const PATH    = "/paapi5/searchitems";
const TARGET  = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const SERVICE = "ProductAdvertisingAPI";
const REGION  = "us-east-1";

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
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => resolve(data));
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

  const opts: aws4.Request = {
    host:    HOST,
    path:    PATH,
    method:  "POST",
    service: SERVICE,
    region:  REGION,
    headers: {
      "Content-Encoding": "amz-1.0",
      "Content-Type":     "application/json; charset=utf-8",
      "X-Amz-Target":    TARGET,
      "Content-Length":  String(Buffer.byteLength(body, "utf8")),
    },
    body,
  };

  aws4.sign(opts, { accessKeyId: accessKey, secretAccessKey: secretKey });

  const responseText = await httpsPost(
    HOST,
    PATH,
    opts.headers as Record<string, string>,
    body
  );

  let parsed: { SearchResult?: { Items?: PaApiRawItem[] }; __type?: string; Errors?: { Code: string; Message: string }[] };
  try {
    parsed = JSON.parse(responseText) as typeof parsed;
  } catch {
    throw new Error(`PA API parse error: ${responseText.slice(0, 200)}`);
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
