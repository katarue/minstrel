import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const asin = request.nextUrl.searchParams.get("asin");
  if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
    return new NextResponse("Invalid ASIN", { status: 400 });
  }

  const url = `https://m.media-amazon.com/images/P/${asin.toUpperCase()}.09.LZZZZZZZ.jpg`;
  try {
    const res = await fetch(url);
    if (!res.ok) return new NextResponse("Not found", { status: 404 });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return new NextResponse("Not an image", { status: 404 });
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
