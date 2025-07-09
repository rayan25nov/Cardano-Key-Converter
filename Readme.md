# Cardano Key Converter (CJS + ESM)

A universal TypeScript package that works seamlessly with both CommonJS (CJS) and ES Modules (ESM) for converting Cardano onchain private keys to offchain private keys compatible with Lucid Cardano.

A TypeScript package 
## Installation

```bash
npm install cardano-key-converter
# or
pnpm install cardano-key-converter
# or
yarn add cardano-key-converter
```

## Features

- Convert CBOR hex private keys to Lucid-compatible Bech32 format
- Read private keys from various file formats (JSON, raw hex)
- Initialize Lucid instances with converted private keys
- Get wallet addresses and UTXOs
- Comprehensive error handling and validation
- Network configuration validation
- TypeScript support

## Usage

### Basic Usage

```typescript
import { Network } from "@aiquant/lucid-cardano";
import CardanoKeyConverter from "cardano-key-converter";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  try {
    // Validate environment variables
    const network = process.env.NETWORK1 || "Preprod";
    const blockfrostApiUrl = process.env.PREPROD_API_URL;
    const blockfrostApiKey = process.env.PREPROD_API_KEY;

    if (!blockfrostApiUrl) {
      throw new Error("PREPROD_API_URL environment variable is required");
    }

    if (!blockfrostApiKey) {
      throw new Error("PREPROD_API_KEY environment variable is required");
    }

    const converter = new CardanoKeyConverter({
      network: network as Network,
      blockfrostApiUrl,
      blockfrostApiKey,
    });

    const keyPath = resolve(__dirname, "payment.skey");

    // Convert private key
    const lucidPrivateKey = await converter.onchainToOffchainPrivateKey(
      keyPath
    );

    // Create Lucid instance and get wallet address
    const lucid = await converter.createLucidWithPrivateKey(keyPath);
    const walletAddress = await lucid.wallet.address();

    // Read and convert CBOR hex
    const cborHex = converter.readPrivateKeyFile(keyPath);
    const cborHexToLucidPrivateKey = await converter.cborHexToLucidPrivateKey(
      cborHex
    );

    console.log("CBOR hex to Lucid Private Key:", cborHexToLucidPrivateKey);
    console.log("Converted private key:", lucidPrivateKey);
    console.log("Wallet Address:", walletAddress);
  } catch (err) {
    console.error("Conversion failed:", err);
    process.exit(1);
  }
}

run();
```

### Create Lucid Instance

```typescript
// Create Lucid instance with converted private key
const lucid = await converter.createLucidWithPrivateKey(
  "./path/to/payment.skey"
);

// Get wallet address
const address = await lucid.wallet.address();
console.log("Wallet address:", address);

// Get UTXOs
const utxos = await lucid.utxosAt(address);
console.log("UTXOs:", utxos);
```

### Utility Functions

```typescript
import { CardanoUtils } from "cardano-key-converter";

// Convert CBOR hex directly
const cborHex =
  "5820a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
const privateKey = await CardanoUtils.cborHexToLucidPrivateKey(cborHex);

// Read private key file
const cborFromFile = CardanoUtils.readPrivateKeyFile("./payment.skey");
```

### Convenience Methods

```typescript
// Get wallet address directly
const address = await converter.getWalletAddress("./path/to/payment.skey");

// Get wallet UTXOs directly
const utxos = await converter.getWalletUtxos("./path/to/payment.skey");
```

## Supported Key Formats

### JSON Format (Cardano CLI)

```json
{
  "type": "PaymentSigningKeyShelley_ed25519",
  "description": "Payment Signing Key",
  "cborHex": "5820a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890"
}
```

### Raw Hex Format

```
5820a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Network configuration (case-sensitive)
NETWORK1=Preprod
# or NETWORK1=Mainnet
# or NETWORK1=Preview

# Blockfrost API configuration
PREPROD_API_KEY=your_blockfrost_api_key_here
PREPROD_API_URL=https://cardano-preprod.blockfrost.io/api/v0

# For Mainnet, use:
# MAINNET_API_KEY=your_mainnet_blockfrost_api_key
# MAINNET_API_URL=https://cardano-mainnet.blockfrost.io/api/v0
```

### Constructor Options

```typescript
interface CardanoConfig {
  network: Network; // "Mainnet" | "Preprod" | "Preview" (case-sensitive)
  blockfrostApiUrl: string; // Blockfrost API URL
  blockfrostApiKey: string; // Your Blockfrost API key
}
```

### Network Configuration

The package validates network parameters to ensure they match Lucid's expected format:

- **Mainnet**: Production network
- **Preprod**: Pre-production testnet
- **Preview**: Preview testnet

⚠️ **Important**: Network names are case-sensitive. Use exact capitalization as shown above.

### Blockfrost URLs

Use the correct Blockfrost API URLs for each network:

- **Preprod**: `https://cardano-preprod.blockfrost.io/api/v0`
- **Mainnet**: `https://cardano-mainnet.blockfrost.io/api/v0`
- **Preview**: `https://cardano-preview.blockfrost.io/api/v0`

## Error Handling

The package includes comprehensive error handling and validation:

```typescript
try {
  const privateKey = await converter.onchainToOffchainPrivateKey(
    "./invalid-path.skey"
  );
} catch (error) {
  console.error("Conversion failed:", error.message);
}
```

### Common Errors and Solutions

#### Network Configuration Errors

- **Error**: `Cannot read properties of undefined (reading 'zeroTime')`

  - **Solution**: Ensure your `.env` file has the correct network name with proper capitalization (`Preprod`, not `preprod`)

- **Error**: `Invalid network: xyz. Must be one of: Mainnet, Preprod, Preview`
  - **Solution**: Use exactly one of the supported network names with correct capitalization

#### API Configuration Errors

- **Error**: `Blockfrost API URL and API key are required`
  - **Solution**: Ensure both `PREPROD_API_URL` and `PREPROD_API_KEY` are set in your `.env` file

#### Key File Errors

- **Error**: `Private key file not found at path`

  - **Solution**: Verify the path to your `.skey` file is correct

- **Error**: `Invalid CBOR hex input`

  - **Solution**: Ensure your key file contains valid CBOR hex data

- **Error**: `CBOR hex must start with '5820' prefix`

  - **Solution**: Your private key should be in the correct CBOR format for 32-byte keys

- **Error**: `Invalid private key length: expected 64 characters`
  - **Solution**: The raw private key (after CBOR prefix) should be exactly 32 bytes (64 hex characters)

## API Reference

### CardanoKeyConverter Class

#### Constructor

```typescript
constructor(config: CardanoConfig)
```

Creates a new CardanoKeyConverter instance with validated configuration.

#### Methods

- `readPrivateKeyFile(keyPath: string): string`
  - Reads and extracts CBOR hex from a private key file
- `cborHexToLucidPrivateKey(cborHex: string): Promise<PrivateKey>`
  - Converts CBOR hex to Lucid-compatible Bech32 private key
- `onchainToOffchainPrivateKey(keyPath: string): Promise<PrivateKey>`
  - Converts onchain private key file to offchain private key
- `createLucidWithPrivateKey(keyPath: string): Promise<Lucid>`
  - Creates initialized Lucid instance with converted private key
- `getWalletAddress(keyPath: string): Promise<string>`
  - Gets wallet address from private key file
- `getWalletUtxos(keyPath: string): Promise<UTxO[]>`
  - Gets wallet UTXOs from private key file

### CardanoUtils Static Methods

- `CardanoUtils.cborHexToLucidPrivateKey(cborHex: string): Promise<PrivateKey>`
  - Static method to convert CBOR hex to Lucid private key
- `CardanoUtils.readPrivateKeyFile(keyPath: string): string`
  - Static method to read private key file

## Troubleshooting

### Debug Mode

Enable debug logging by adding console logs to track the conversion process:

```typescript
console.log("Environment variables:", {
  network: process.env.NETWORK1,
  apiUrl: process.env.PREPROD_API_URL,
  hasApiKey: !!process.env.PREPROD_API_KEY,
});
```

### Verification Steps

1. **Check Environment Variables**: Ensure all required environment variables are set
2. **Validate Network Name**: Verify network name matches exactly: `Mainnet`, `Preprod`, or `Preview`
3. **Test API Connection**: Verify your Blockfrost API key and URL are correct
4. **Check Key File**: Ensure your `.skey` file exists and contains valid CBOR hex

## Examples

Check the `test/manualTest.ts` file for comprehensive usage examples with proper error handling.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

## Changelog

### Recent Updates

- Added network validation to prevent `zeroTime` errors
- Enhanced error handling and debugging
- Improved environment variable validation
- Added comprehensive troubleshooting guide
