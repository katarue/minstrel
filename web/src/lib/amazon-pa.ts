/**
 * Amazon Product Advertising API v5 クライアント（Japan向け）
 * aws4 パッケージで AWS Signature Version 4 署名を行う。
 */
import aws4 from "aws4";

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
    },
    body,
  };

  aws4.sign(opts, { accessKeyId: accessKey, secretAccessKey: secretKey });

  const resp = await fetch(`https://${HOST}${PATH}`, {
    method:  "POST",
    headers: opts.headers as Record<string, string>,
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PA API ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = await resp.json() as {
    SearchResult?: { Items?: PaApiRawItem[] };
  };
  const items = data?.SearchResult?.Items ?? [];

  return items.map((item) => ({
    asin:         item.ASIN ?? "",
    title:        item.ItemInfo?.Title?.DisplayValue ?? "",
    imageUrl:     item.Images?.Primary?.Large?.URL ?? null,
    affiliateUrl: `https://www.amazon.co.jp/dp/${item.ASIN}?tag=${partnerTag}`,
  }));
}
