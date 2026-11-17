/**
 * Server Bootstrap Entrypoint
 */

import { App } from './App.ts';
import { Config } from './utils/Config.ts';

declare const Deno: any;

console.log(`=========================================`);
console.log(`🚀 Starting AssertNow Backend Engine...`);
console.log(`⚙️  Runtime: Deno ${Deno.version.deno}`);
console.log(`📡 Port: ${Config.PORT}`);
console.log(`=========================================`);

Deno.serve(
  {
    port: Config.PORT,
    hostname: Config.HOST,
    onListen({ port, hostname }: { port: number; hostname: string }) {
      console.log(`✅ AssertNow API running at http://${hostname}:${port}`);
      console.log(`📊 Health probe available at http://${hostname}:${port}/health`);
    },
  },
  App.fetch
);

