import { Network } from "@aiquant/lucid-cardano";
import CardanoKeyConverter from "../src/CardanoKeyConverter";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const converter = new CardanoKeyConverter({
    network: (process.env.NETWORK1 as Network) || "Preprod",
    blockfrostApiUrl: process.env.PREPROD_API_URL!,
    blockfrostApiKey: process.env.PREPROD_API_KEY!,
  });

  const keyPath = resolve(__dirname, "payment.skey");
  try {
    const lucidPrivateKey = await converter.onchainToOffchainPrivateKey(
      keyPath
    );

    // const walletAddress = await converter.getWalletAddress(keyPath);
    const lucid = await converter.createLucidWithPrivateKey(keyPath);
    const walletAddress = await lucid.wallet.address();

    const cborHex = converter.readPrivateKeyFile(keyPath);

    const cborHexToLucidPrivateKey = await converter.cborHexToLucidPrivateKey(
      cborHex
    );
    console.log("cborHex To Lucid Private Key ", cborHexToLucidPrivateKey);

    console.log("Converted private key:", lucidPrivateKey);
    console.log("Wallet Address: ", walletAddress);
  } catch (err) {
    console.error("Conversion failed:", err);
    process.exit(1);
  }
}

run();
