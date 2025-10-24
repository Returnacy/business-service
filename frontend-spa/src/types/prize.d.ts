export type PrizeType = {
  name: string;
  id: string;
  brandId: string | null;
  businessId: string | null;
  pointsRequired: number;
  createdAt: Date;
  updatedAt: Date;
}