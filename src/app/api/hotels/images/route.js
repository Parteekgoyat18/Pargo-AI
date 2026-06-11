import { getHotelImages } from '@/app/lib/hotelbeds';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const codes = searchParams.get('codes') || '';
  if (!codes.trim()) return Response.json({});
  const images = await getHotelImages(codes);
  return Response.json(images);
}
