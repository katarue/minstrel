import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const asin = request.nextUrl.searchParams.get("asin");
  if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
    return new NextResponse("Invalid ASIN", { status: 400 });
  }

  const url = `https://m.media-amazon.com/images/P/${asin.toUpperCase()}.09.LZZZZZZZ.jpg`;
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") ?? "";
    const buffer = await res.arrayBuffer();
    console.log(`[amazon-image] ASIN=${asin} status=${res.status} content-type="${contentType}" bytes=${buffer.byteLength}`);
    if (!res.ok) return new NextResponse("Not found", { status: 404 });
    if (!contentType.startsWith("image/")) return new NextResponse("Not an image", { status: 404 });
    // Reject suspiciously small images (likely 1x1 transparent placeholders, typically < 200 bytes)
    if (buffer.byteLength < 200) {
      console.log(`[amazon-image] ASIN=${asin} rejected: too small (${buffer.byteLength} bytes)`);
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error(`[amazon-image] ASIN=${asin} error:`, err);
    return new NextResponse("Error", { status: 500 });
  }
}
