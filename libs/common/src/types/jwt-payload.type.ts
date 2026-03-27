export interface JwtPayload {
  sub: string;
  phone?: string;
  role?: string;
  tenantId: string;
}
