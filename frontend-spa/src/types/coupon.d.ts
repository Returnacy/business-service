export type CouponType = {
  id?: string;
  createdAt: Date;
  code: string;
  qrCode?: string;
  url: string;
  isRedeemed: boolean;
  redeemedAt: Date | null;
  expiredAt?: Date | null;
  prize?: {
    pointsRequired: number;
    name: string;
  };
}