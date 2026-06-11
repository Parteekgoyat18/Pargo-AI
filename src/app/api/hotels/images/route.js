import { getHotelImages } from '@/app/lib/hotelbeds';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const codes = searchParams.get('codes') || '';
  if (!codes.trim()) return Response.json({});
  const images = await getHotelImages(codes);
  const keys = Object.keys(images);
  console.log('[/api/hotels/images] codes:', codes);
  console.log('[/api/hotels/images] result keys:', keys);
  const firstUrls = Object.values(images)[0] || [];
  console.log('[/api/hotels/images] first hotel url count:', firstUrls.length);
  if (firstUrls[0]) console.log('[/api/hotels/images] first url:', firstUrls[0]);
  return Response.json(images);
}
