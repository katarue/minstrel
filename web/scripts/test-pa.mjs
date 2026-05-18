import crypto from "node:crypto";
import https from "node:https";

const HOST    = "webservices.amazon.co.jp";
const PATH    = "/paapi5/searchitems";
const TARGET  = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const SERVICE = "ProductAdvertisingAPI";
const REGION  = "us-east-1";
const ALGORITHM = "AWS4-HMAC-SHA256";

const accessKey  = "AKPAHZ6SV71779072533";
const secretKey  = "cnnhFFW1aOe8mSCujU+jLc2lKMQD3JK83TMtT4eW";
const partnerTag = "k0642-22";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}
function sha256hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function getSignatureKey(sk, ds) {
  return hmac(hmac(hmac(hmac("AWS4" + sk, ds), REGION), SERVICE), "aws4_request");
}

function makeBody(escapeUnicode) {
  const raw = JSON.stringify({
    Keywords: "FINAL FANTASY サウンドトラック",
    Resources: ["Images.Primary.Large", "ItemInfo.Title", "DetailPageURL"],
    SearchIndex: "Music",
    ItemCount: 5,
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: "www.amazon.co.jp",
  });
  if (!escapeUnicode) return raw;
  return raw.replace(/[-￿]/g, (c) =>
    "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

function test(label, body) {
  return new Promise((resolve) => {
    const bodyBuf = Buffer.from(body, "utf8");
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256hex(bodyBuf);

    const canonicalHeaders =
      "content-encoding:amz-1.0\n" +
      "content-type:application/json; charset=utf-8\n" +
      "host:" + HOST + "\n" +
      "x-amz-date:" + amzDate + "\n" +
      "x-amz-target:" + TARGET + "\n";
    const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

    const canonicalRequest = "POST\n" + PATH + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;
    const credentialScope = dateStamp + "/" + REGION + "/" + SERVICE + "/aws4_request";
    const stringToSign = ALGORITHM + "\n" + amzDate + "\n" + credentialScope + "\n" + sha256hex(canonicalRequest);
    const signature = hmac(getSignatureKey(secretKey, dateStamp), stringToSign).toString("hex");
    const authorization = ALGORITHM + " Credential=" + accessKey + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

    console.log(`\n[${label}] body length=${bodyBuf.length}, payloadHash=${payloadHash.slice(0,16)}...`);

    const req = https.request({
      hostname: HOST, path: PATH, method: "POST",
      headers: {
        "Content-Encoding": "amz-1.0",
        "Content-Type": "application/json; charset=utf-8",
        "Host": HOST,
        "X-Amz-Date": amzDate,
        "X-Amz-Target": TARGET,
        "Authorization": authorization,
        "Content-Length": bodyBuf.length,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        console.log(`[${label}] HTTP ${res.statusCode}: ${text.slice(0, 200)}`);
        resolve();
      });
    });
    req.on("error", (e) => { console.error(`[${label}] error:`, e.message); resolve(); });
    req.write(bodyBuf);
    req.end();
  });
}

// パターンA: 生のJSON（日本語そのまま）
await test("raw-utf8", makeBody(false));
// パターンB: Unicodeエスケープ済みJSON
await test("unicode-escaped", makeBody(true));
