/**
 * Application Configuration & Environment Variable Reader
 */

export class Config {
  public static readonly PORT: number = Number(Deno.env.get('PORT') || 3001);
  public static readonly HOST: string = Deno.env.get('HOST') || '0.0.0.0';
  public static readonly NODE_ENV: string = Deno.env.get('NODE_ENV') || 'development';
  public static readonly ENCRYPTION_SECRET: string = Deno.env.get('ASSERTNOW_SECRET_KEY') || 'assertnow-enterprise-master-key-32chars!';
  public static readonly CORS_ORIGIN: string = Deno.env.get('CORS_ORIGIN') || '*';
}

