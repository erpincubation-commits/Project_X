import { createApplication } from './bootstrap';
import { settings } from './config';

async function main() {
  const config = settings();
  const app = await createApplication();
  await app.listen(config.port, config.host);
  console.log(`ERP API ready at http://${config.host}:${config.port}/api/v1`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Server startup failed.'); process.exitCode = 1; });
