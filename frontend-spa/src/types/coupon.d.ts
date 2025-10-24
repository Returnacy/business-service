export type CouponType = {
  id?: string;
  createdAt: Date;
  code: string;
  url: string;
  isRedeemed: boolean;
  redeemedAt: Date | null;
  prize?: {
    pointsRequired: number;
    name: string;
  };
}