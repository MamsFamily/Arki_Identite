export type MapLandmark = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  image: string;
};

const landmarks: Record<string, MapLandmark[]> = {
  valguero: [{ id: "shop", name: "Shop", lat: 60, lon: 92, image: "/map-valguero-shop.png" }],
};

export const getMapLandmarks = (slug: string): MapLandmark[] => landmarks[slug] ?? [];
