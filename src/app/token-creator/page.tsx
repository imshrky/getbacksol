"use client";

import { useMemo, useState } from "react";
import { ImagePlus, ChevronDown } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Faq } from "@/components/ui/Faq";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";

const BASE_COST = 0.2;
const TOGGLE_COST = 0.1;

const STEPS = [
  "Connect your Solana wallet.",
  "Specify the desired name for your token.",
  "Indicate the symbol (max 8 characters).",
  "Select the decimals quantity (6 is recommended for most tokens).",
  "Provide a brief description for your SPL token.",
  "Upload an image for your token (PNG/JPG).",
  "Determine the total supply of your token.",
  "Click Create, approve the transaction in your wallet, and wait for confirmation.",
];

const FAQ_ITEMS = [
  {
    q: "What is the Token Creator?",
    a: "A no-code interface for minting SPL tokens on Solana. You fill in the token details, connect a wallet, and the interface builds the on-chain transaction for you.",
  },
  {
    q: "Is it safe to create tokens here?",
    a: "This build is a UI mockup. Once wired to a real program (see the backend architecture doc), all actions happen through your own wallet signature — funds and mint authority stay in your control.",
  },
  {
    q: "How long does it take?",
    a: "On a live deployment, token creation typically confirms in a few seconds once you approve the transaction.",
  },
  {
    q: "How much does it cost?",
    a: "Example pricing shown here: a 0.2 SOL base fee, plus 0.1 SOL for each optional authority revoke. Final pricing is configurable in the backend.",
  },
  {
    q: "Which wallets are supported?",
    a: "Any Wallet Standard–compatible wallet, including Phantom, Solflare, and Backpack.",
  },
];

export default function TokenCreatorPage() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [supply, setSupply] = useState("1000000000");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [revokeFreeze, setRevokeFreeze] = useState(true);
  const [revokeMint, setRevokeMint] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");

  const { status, message, run } = useSimulatedTx();

  const totalCost = useMemo(() => {
    let cost = BASE_COST;
    if (revokeFreeze) cost += TOGGLE_COST;
    if (revokeMint) cost += TOGGLE_COST;
    return cost.toFixed(2);
  }, [revokeFreeze, revokeMint]);

  const canSubmit = name.trim().length > 0 && symbol.trim().length > 0 && Number(supply) > 0;

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="fade-in">
      <SectionTitle
        index="02"
        eyebrow="SPL Token Creator"
        title="Create your Solana token"
        description="Effortlessly create your Solana SPL token with a guided, no-code flow. Ready in minutes."
      />

      <Card className="mx-auto max-w-2xl">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Name</label>
            <input
              className="field-input"
              placeholder="e.g. Nebula Coin"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Symbol (max 8 chars)
            </label>
            <input
              className="field-input"
              placeholder="e.g. NEBU"
              maxLength={8}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Decimals
            </label>
            <input
              type="number"
              min={0}
              max={9}
              className="field-input"
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Supply
            </label>
            <input
              type="number"
              min={1}
              className="field-input"
              value={supply}
              onChange={(e) => setSupply(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
            Description
          </label>
          <textarea
            className="field-input min-h-20 resize-none"
            placeholder="What is this token for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Image</label>
          <label className="flex h-28 cursor-pointer items-center justify-center gap-3 rounded-[8px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] text-sm text-[var(--muted)] hover:border-[var(--accent)]">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Token" className="h-20 w-20 rounded-[8px] object-cover" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                PNG, up to 1MB
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </label>
        </div>

        <div className="mt-6 space-y-3">
          <Toggle
            checked={revokeFreeze}
            onChange={setRevokeFreeze}
            label="Revoke Freeze Authority (required for liquidity pools)"
            hint="Lets you create a liquidity pool later."
            cost={`${TOGGLE_COST.toFixed(1)} SOL`}
          />
          <Toggle
            checked={revokeMint}
            onChange={setRevokeMint}
            label="Revoke Mint Authority"
            hint="Guarantees supply can never be increased. Can be done later instead."
            cost={`${TOGGLE_COST.toFixed(1)} SOL`}
          />
        </div>

        <button
          className="mt-5 flex items-center gap-1 text-xs font-medium text-[var(--accent)]"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Hide options" : "Show more options"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
        </button>

        {showMore && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Website
              </label>
              <input
                className="field-input"
                placeholder="https://"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Twitter / X
              </label>
              <input
                className="field-input"
                placeholder="@handle"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Telegram
              </label>
              <input
                className="field-input"
                placeholder="t.me/..."
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between rounded-[8px] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <span className="text-[var(--muted)]">Total cost</span>
          <span className="font-semibold">{totalCost} SOL</span>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={!canSubmit || status === "pending"}
          onClick={() =>
            run(`"${name || symbol}" created. Mint address will appear here once live on-chain.`)
          }
        >
          {status === "pending" ? "Creating token…" : "Create Token"}
        </button>

        <TxStatusBanner status={status} message={message} />
      </Card>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-5 text-center text-xl font-semibold">How to use the Token Creator</h2>
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-xs font-semibold">
                {i + 1}
              </span>
              <span className="text-[var(--muted)]">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-5 text-center text-xl font-semibold">Frequently asked questions</h2>
        <Faq items={FAQ_ITEMS} />
      </section>
    </div>
  );
}
