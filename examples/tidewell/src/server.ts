import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);
const { app } = createApp({ dataDir: process.env.DATA_DIR ?? './data' });

app.listen(port, () => {
  // A single startup line is fine here; everything else goes through the logger.
  console.log(`Tidewell listening on http://localhost:${port}`);
});
