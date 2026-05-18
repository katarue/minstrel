import ProductAdvertisingAPIv1 from "paapi5-nodejs-sdk";

const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
defaultClient.accessKey = "AKPAKMECYV1779068957";
defaultClient.secretKey = "rYC3cTeTXuNoZUitUgyjTonxsOvMEzP7lPv0ua8N";
defaultClient.host = "webservices.amazon.co.jp";
defaultClient.region = "us-east-1";

const api = new ProductAdvertisingAPIv1.DefaultApi();

const request = new ProductAdvertisingAPIv1.SearchItemsRequest();
request.Keywords = "FINAL FANTASY サウンドトラック";
request.SearchIndex = "Music";
request.PartnerTag = "k0642-22";
request.PartnerType = "Associates";
request.Marketplace = "www.amazon.co.jp";
request.Resources = [
  ProductAdvertisingAPIv1.SearchItemsResource.IMAGESPLARGE,
  ProductAdvertisingAPIv1.SearchItemsResource.ITEMINFOBTITLE,
];

api.searchItems(request, (error, data, response) => {
  if (error) {
    console.error("SDK error:", JSON.stringify(error?.response?.body ?? error, null, 2));
  } else {
    console.log("SDK success:", JSON.stringify(data?.SearchResult?.Items?.length), "items");
  }
});
