import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

// Metaplex Token Metadata program — the standard that makes a mint show up in
// wallets with a name, symbol and logo instead of just an address.
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

/** The metadata account PDA derived for a given mint. */
export function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function serializeString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

/**
 * Builds a CreateMetadataAccountV3 instruction by hand (no Metaplex SDK
 * dependency, which would drag in the umi framework and a separate signing
 * model). Serializes the DataV2 struct exactly as the on-chain program
 * expects: name/symbol/uri strings, a u16 seller fee, and None for the
 * optional creators/collection/uses fields, then isMutable and a final None
 * for collectionDetails.
 *
 * `uri` points at a hosted JSON ({ name, symbol, description, image }) — see
 * /api/upload-token-metadata.
 */
export function createMetadataInstruction(params: {
  mint: PublicKey;
  mintAuthority: PublicKey;
  payer: PublicKey;
  updateAuthority: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
}): TransactionInstruction {
  const data = Buffer.concat([
    Buffer.from([33]), // CreateMetadataAccountV3 discriminator
    serializeString(params.name),
    serializeString(params.symbol),
    serializeString(params.uri),
    Buffer.from([0, 0]), // sellerFeeBasisPoints: u16 = 0
    Buffer.from([0]), // creators: Option = None
    Buffer.from([0]), // collection: Option = None
    Buffer.from([0]), // uses: Option = None
    Buffer.from([params.isMutable ? 1 : 0]), // isMutable
    Buffer.from([0]), // collectionDetails: Option = None
  ]);

  return new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataPda(params.mint), isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: params.mintAuthority, isSigner: true, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: params.updateAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
