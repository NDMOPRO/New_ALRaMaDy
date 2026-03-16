import { startPresentationPlatformServer } from "./platform";

const PORT = Number(process.env.PORT) || 3000;

startPresentationPlatformServer({ port: PORT, host: "0.0.0.0" }).then(({ origin }) => {
  console.log(`Platform server running at ${origin}`);
  console.log(`Test interface: ${origin}/test-interface`);
});
