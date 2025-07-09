import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { Lucid, Blockfrost, PrivateKey, Network } from "@aiquant/lucid-cardano";
import { CardanoKeyConverter, CardanoUtils } from "../src/CardanoKeyConverter";
import { CardanoConfig } from "../src/cardanoKeyConverter";

// Mock external dependencies
vi.mock("fs");
vi.mock("@aiquant/lucid-cardano");
vi.mock("dotenv");

// Mock bech32 module
const mockBech32 = {
  toWords: vi.fn(),
  encode: vi.fn(),
};
vi.mock("bech32", () => ({ bech32: mockBech32 }));

describe("CardanoKeyConverter", () => {
  let converter: CardanoKeyConverter;
  let mockConfig: CardanoConfig;
  let mockLucid: any;
  let mockBlockfrost: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      network: "Mainnet" as Network,
      blockfrostApiUrl: "https://cardano-mainnet.blockfrost.io/api/v0",
      blockfrostApiKey: "test-api-key",
    };

    mockLucid = {
      wallet: { address: vi.fn().mockResolvedValue("addr1test123") },
      selectWalletFromPrivateKey: vi.fn(),
      utxosAt: vi.fn().mockResolvedValue([]),
    };
    mockBlockfrost = vi.fn();
    (Blockfrost as any).mockImplementation(() => mockBlockfrost);
    (Lucid.new as any).mockResolvedValue(mockLucid);

    mockBech32.toWords.mockReturnValue([1, 2, 3, 4, 5]);
    mockBech32.encode.mockReturnValue("ed25519_sk1testkey");

    converter = new CardanoKeyConverter(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct config", () => {
      expect(converter.network).toBe("Mainnet");
      expect(converter.blockfrostApiUrl).toBe(mockConfig.blockfrostApiUrl);
      expect(converter.blockfrostApiKey).toBe(mockConfig.blockfrostApiKey);
    });
  });

  describe("readPrivateKeyFile", () => {
    const mockExistsSync = existsSync as Mock;
    const mockReadFileSync = readFileSync as Mock;

    it("should read valid JSON key file with cborHex", () => {
      const cborHex = "5820" + "aa".repeat(32);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ cborHex }));
      expect(converter.readPrivateKeyFile("/path/key.json")).toBe(cborHex);
    });

    it("should read PaymentSigningKeyShelley format", () => {
      const cborHex = "5820" + "bb".repeat(32);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ type: "PaymentSigningKeyShelley_ed25519", cborHex })
      );
      expect(converter.readPrivateKeyFile("/path/key.json")).toBe(cborHex);
    });

    it("should read JSON string value", () => {
      const cborHex = "5820" + "cc".repeat(32);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(cborHex));
      expect(converter.readPrivateKeyFile("/path/key.json")).toBe(cborHex);
    });

    it("should read raw hex file", () => {
      const cborHex = "5820" + "dd".repeat(32);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(cborHex);
      expect(converter.readPrivateKeyFile("/path/key.txt")).toBe(cborHex);
    });

    it("should throw if file missing", () => {
      mockExistsSync.mockReturnValue(false);
      expect(() => converter.readPrivateKeyFile("/missing.key")).toThrow(
        "Private key file not found at path: /missing.key"
      );
    });

    it("should throw for invalid JSON structure", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ foo: "bar" }));
      expect(() => converter.readPrivateKeyFile("/path/key.json")).toThrow(
        "File content is neither valid JSON nor valid hex string"
      );
    });

    it("should throw for invalid hex", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("zzzz");
      expect(() => converter.readPrivateKeyFile("/path/key.txt")).toThrow(
        "File content is neither valid JSON nor valid hex string"
      );
    });

    it("should throw on read error", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error("fail");
      });
      expect(() => converter.readPrivateKeyFile("/path/key.json")).toThrow(
        "Error reading private key file: fail"
      );
    });
  });

  describe("cborHexToLucidPrivateKey", () => {
    it("should convert valid CBOR hex", async () => {
      const hex = "5820" + "aa".repeat(32);
      const result = await converter.cborHexToLucidPrivateKey(hex);
      expect(result).toBe("ed25519_sk1testkey");
      expect(mockBech32.toWords).toHaveBeenCalledWith(
        Buffer.from("aa".repeat(32), "hex")
      );
    });

    it("should throw for empty or invalid input", async () => {
      await expect(converter.cborHexToLucidPrivateKey("")).rejects.toThrow(
        "Invalid CBOR hex input"
      );
    });

    it("should throw missing prefix", async () => {
      await expect(converter.cborHexToLucidPrivateKey("abcd")).rejects.toThrow(
        "CBOR hex must start with '5820'"
      );
    });

    it("should throw bad length", async () => {
      const hex = "5820" + "aa".repeat(4);
      await expect(converter.cborHexToLucidPrivateKey(hex)).rejects.toThrow(
        "Invalid private key length: expected 64 characters, got 8"
      );
    });

    it("should error on encoder failure", async () => {
      mockBech32.toWords.mockImplementation(() => {
        throw new Error("enc fail");
      });
      await expect(
        converter.cborHexToLucidPrivateKey("5820" + "aa".repeat(32))
      ).rejects.toThrow();
    });
  });

  describe("onchainToOffchainPrivateKey", () => {
    const mockExistsSync = existsSync as Mock;
    const mockReadFileSync = readFileSync as Mock;

    it("should convert workflow", async () => {
      const cbor = "5820" + "ee".repeat(32);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(cbor);
      await expect(
        converter.onchainToOffchainPrivateKey("/path/key.json")
      ).resolves.toBe("ed25519_sk1testkey");
    });

    it("should throw if missing file", async () => {
      mockExistsSync.mockReturnValue(false);
      await expect(
        converter.onchainToOffchainPrivateKey("/no.key")
      ).rejects.toThrow("Private key file not found at path: /no.key");
    });
  });
});
