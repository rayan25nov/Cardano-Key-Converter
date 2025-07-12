import { Lucid, PrivateKey, Network, UTxO } from "@lucid-evolution/lucid";
import { Bech32Encoder, CardanoConfig } from "./cardanoKeyConverter";

export interface Bech32Encoder {
  toWords(bytes: Uint8Array): number[];
  encode(prefix: string, words: number[]): string;
}

export interface CardanoConfig {
  network: Network;
  blockfrostApiUrl: string;
  blockfrostApiKey: string;
}

export default class CardanoKeyConverter {
  constructor(config: CardanoConfig);

  public readPrivateKeyFile(keyPath: string): string;
  public cborHexToLucidPrivateKey(cborHex: string): Promise<PrivateKey>;
  public onchainToOffchainPrivateKey(keyPath: string): Promise<PrivateKey>;
  public createLucidWithPrivateKey(keyPath: string): Promise<Lucid>;
  public getWalletAddress(keyPath: string): Promise<string>;
  public getWalletUtxos(keyPath: string): Promise<UTxO[]>;
}

export const CardanoUtils: {
  cborHexToLucidPrivateKey(cborHex: string): Promise<PrivateKey>;
  readPrivateKeyFile(keyPath: string): string;
};
