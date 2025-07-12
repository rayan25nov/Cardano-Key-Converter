// src/CardanoKeyConverter.ts
import { existsSync, readFileSync } from "fs";
import {
  Lucid,
  Blockfrost,
  PrivateKey,
  Network,
  LucidEvolution,
} from "@lucid-evolution/lucid";
import dotenv from "dotenv";
dotenv.config();

// Type for bech32 encoder methods
interface Bech32Encoder {
  toWords(bytes: Uint8Array): number[];
  encode(prefix: string, words: number[], limit?: number): string;
}

/**
 * Configuration interface for CardanoKeyConverter
 */
interface CardanoConfig {
  /** The Cardano network to use */
  network: Network;
  /** Blockfrost API URL */
  blockfrostApiUrl: string;
  /** Blockfrost API key */
  blockfrostApiKey: string;
}
export class CardanoKeyConverter {
  public network: Network;
  public blockfrostApiUrl: string;
  public blockfrostApiKey: string;
  private bech32Encoder: Bech32Encoder | null = null;

  constructor(config: CardanoConfig) {
    this.network = config.network;
    this.blockfrostApiUrl = config.blockfrostApiUrl;
    this.blockfrostApiKey = config.blockfrostApiKey;
  }

  // Initialize bech32 encoder dynamically
  private async initBech32Encoder(): Promise<Bech32Encoder> {
    if (this.bech32Encoder) return this.bech32Encoder;

    try {
      // ESM-style import
      const bech32Package = await import("bech32");
      this.bech32Encoder = bech32Package.bech32;
    } catch (e) {
      try {
        // CJS fallback
        this.bech32Encoder = require("bech32").bech32;
      } catch (err) {
        throw new Error(
          `Failed to load bech32 encoder: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    if (!this.bech32Encoder) {
      throw new Error("Failed to initialize bech32 encoder");
    }
    return this.bech32Encoder;
  }

  /**
   * Reads a private key file and extracts CBOR hex
   * @param keyPath - Path to the private key file
   * @returns The CBOR hex string
   */
  public readPrivateKeyFile(keyPath: string): string {
    try {
      if (!existsSync(keyPath)) {
        throw new Error(`Private key file not found at path: ${keyPath}`);
      }

      const fileContent = readFileSync(keyPath, "utf8");

      // Try to parse as JSON first (common format for Cardano keys)
      try {
        const keyData = JSON.parse(fileContent);

        // Handle different key formats
        if (keyData.cborHex) {
          return keyData.cborHex;
        } else if (
          keyData.type === "PaymentSigningKeyShelley_ed25519" &&
          keyData.cborHex
        ) {
          return keyData.cborHex;
        } else if (typeof keyData === "string" && keyData.length > 0) {
          // If it's just a string, assume it's the CBOR hex
          return keyData;
        } else {
          throw new Error("Unable to extract CBOR hex from JSON structure");
        }
      } catch (jsonError) {
        // If not JSON, assume it's a raw hex string
        const trimmedContent = fileContent.trim();
        if (this.isValidHex(trimmedContent)) {
          return trimmedContent;
        } else {
          throw new Error(
            "File content is neither valid JSON nor valid hex string"
          );
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading private key file: ${error.message}`);
      } else {
        throw new Error(`Error reading private key file: ${String(error)}`);
      }
    }
  }

  /**
   * Validates if a string is valid hexadecimal
   * @param hex - The hex string to validate
   * @returns boolean
   */
  private isValidHex(hex: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0;
  }

  /**
   * Converts CBOR hex to Lucid-compatible private key
   * @param cborHex - The CBOR hex string
   * @returns Bech32-encoded private key for Lucid
   */
  public async cborHexToLucidPrivateKey(cborHex: string): Promise<PrivateKey> {
    try {
      // Validate input
      if (!cborHex || typeof cborHex !== "string") {
        throw new Error("Invalid CBOR hex input");
      }

      // Remove any whitespace
      const cleanHex = cborHex.trim();

      // Check if it starts with the CBOR prefix (5820 for 32-byte bytestring)
      if (!cleanHex.startsWith("5820")) {
        throw new Error(
          "CBOR hex must start with '5820' prefix for 32-byte private key"
        );
      }

      // Extract the 32-byte private key (remove the first 4 characters "5820")
      const rawHex = cleanHex.slice(4);

      // Validate the raw hex length (should be 64 characters for 32 bytes)
      if (rawHex.length !== 64) {
        throw new Error(
          `Invalid private key length: expected 64 characters, got ${rawHex.length}`
        );
      }

      // Convert hex to bytes
      const bytes = Buffer.from(rawHex, "hex");

      // Encode as Bech32 with ed25519_sk prefix
      const encoder = await this.initBech32Encoder();
      const words = encoder.toWords(bytes);
      const lucidSk = encoder.encode("ed25519_sk", words);

      return lucidSk as PrivateKey;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Error converting CBOR hex to Lucid private key: ${error.message}`
        );
      } else {
        throw new Error(
          `Error converting CBOR hex to Lucid private key: ${String(error)}`
        );
      }
    }
  }

  /**
   * Converts onchain private key file to offchain private key
   * @param keyPath - Path to the onchain private key file
   * @returns Lucid-compatible private key
   */
  public async onchainToOffchainPrivateKey(
    keyPath: string
  ): Promise<PrivateKey> {
    try {
      // Read the CBOR hex from file
      const cborHex = this.readPrivateKeyFile(keyPath);

      // Convert to Lucid private key
      const lucidPrivateKey = await this.cborHexToLucidPrivateKey(cborHex);

      return lucidPrivateKey;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Error converting onchain to offchain private key: ${error.message}`
        );
      } else {
        throw new Error(
          `Error converting onchain to offchain private key: ${String(error)}`
        );
      }
    }
  }

  /**
   * Creates a Lucid instance with the converted private key
   * @param keyPath - Path to the onchain private key file
   * @returns Initialized Lucid instance with wallet selected
   */
  public async createLucidWithPrivateKey(
    keyPath: string
  ): Promise<LucidEvolution> {
    try {
      // Initialize Lucid

      const lucid = await Lucid(
        new Blockfrost(this.blockfrostApiUrl, this.blockfrostApiKey),
        this.network
      );

      // Convert and select wallet
      const privateKey = await this.onchainToOffchainPrivateKey(keyPath);
      lucid.selectWallet.fromPrivateKey(privateKey);

      return lucid;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Error creating Lucid instance with private key: ${error.message}`
        );
      } else {
        throw new Error(
          `Error creating Lucid instance with private key: ${String(error)}`
        );
      }
    }
  }

  /**
   * Gets wallet address from private key file
   * @param keyPath - Path to the onchain private key file
   * @returns Wallet address
   */
  public async getWalletAddress(keyPath: string): Promise<string> {
    try {
      const lucid = await this.createLucidWithPrivateKey(keyPath);
      return await lucid.wallet().address();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error getting wallet address: ${error.message}`);
      } else {
        throw new Error(`Error getting wallet address: ${String(error)}`);
      }
    }
  }

  /**
   * Gets UTXOs for the wallet from private key file
   * @param keyPath - Path to the onchain private key file
   * @returns Array of UTXOs
   */
  public async getWalletUtxos(keyPath: string) {
    try {
      const lucid = await this.createLucidWithPrivateKey(keyPath);
      const address = await lucid.wallet().address();
      return await lucid.utxosAt(address);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error getting wallet UTXOs: ${error.message}`);
      } else {
        throw new Error(`Error getting wallet UTXOs: ${String(error)}`);
      }
    }
  }
}

// Export utility functions
export const CardanoUtils = {
  /**
   * Static method to quickly convert CBOR hex to Lucid private key
   * @param cborHex - The CBOR hex string
   * @returns Bech32-encoded private key
   */
  cborHexToLucidPrivateKey: async (cborHex: string): Promise<PrivateKey> => {
    const converter = new CardanoKeyConverter({
      network: "Mainnet",
      blockfrostApiUrl: "",
      blockfrostApiKey: "",
    });
    return await converter.cborHexToLucidPrivateKey(cborHex);
  },

  /**
   * Static method to read private key file
   * @param keyPath - Path to the private key file
   * @returns CBOR hex string
   */
  readPrivateKeyFile: (keyPath: string): string => {
    const converter = new CardanoKeyConverter({
      network: "Mainnet",
      blockfrostApiUrl: "",
      blockfrostApiKey: "",
    });
    return converter.readPrivateKeyFile(keyPath);
  },
};

// Default export
export default CardanoKeyConverter;
