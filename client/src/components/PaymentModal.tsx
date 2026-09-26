import React, { useState } from "react";
import {
  X,
  CreditCard,
  ShieldCheck,
  Check,
  Sparkles,
  Lock,
  ArrowRight,
  Loader2,
  Copy,
  Receipt,
  Tag,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { usePro } from "@/contexts/ProContext";
import { toast } from "sonner";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  interval?: "monthly" | "yearly";
}

export function PaymentModal({ isOpen, onClose, interval = "monthly" }: PaymentModalProps) {
  const { user } = useAuthContext();
  const { activatePro } = usePro();
  const utils = trpc.useUtils();

  const paymentConfigQuery = trpc.auth.getPaymentConfig.useQuery(undefined, {
    enabled: isOpen,
    staleTime: 60_000,
  });

  const [selectedMethod, setSelectedMethod] = useState<"card" | "paypal" | "crypto">("card");
  const [selectedCrypto, setSelectedCrypto] = useState<"usdtTrc20" | "btc" | "eth">("usdtTrc20");
  const [cryptoTxid, setCryptoTxid] = useState("");
  const [copied, setCopied] = useState(false);

  // Card Inputs
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState(user?.name || "Alex Creator");

  // Promo Code
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPercent: number;
    description: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    transactionId: string;
    amount: number;
    currency: string;
    interval: string;
    date: string;
    method: string;
    cardLast4?: string;
  } | null>(null);

  const promoMutation = trpc.auth.validatePromoCode.useMutation({
    onSuccess: (data) => {
      setAppliedPromo(data);
      toast.success(`Promo code applied: ${data.discountPercent}% OFF!`, {
        description: data.description,
      });
    },
    onError: (err) => {
      toast.error(err.message || "Invalid promo code");
    },
  });

  const upgradeMutation = trpc.auth.upgradePlan.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data.user as any);
      utils.account.overview.invalidate();
      activatePro(`CBDROP-SUB-${data.payment.id}`);
      setIsProcessing(false);
      setReceiptData(data.receipt);
      toast.success("Payment successful! You are now a CBdrop Pro member! 🎉", {
        description: "Ultra HD 4K, 1-Click ZIP, and 100% ad-free experience unlocked.",
      });
    },
    onError: (err) => {
      setIsProcessing(false);
      toast.error(err.message || "Payment processing failed");
    },
  });

  if (!isOpen) return null;

  const basePrice = interval === "yearly" ? 29 : 4.99;
  const discountMultiplier = appliedPromo ? 1 - appliedPromo.discountPercent / 100 : 1;
  const price = Math.max(0, Number((basePrice * discountMultiplier).toFixed(2)));

  // Card Formatters
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(" ") || raw;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvc(raw);
  };

  const handleFillTestCard = () => {
    setCardNumber("4242 4242 4242 4242");
    setCardExpiry("12/28");
    setCardCvc("888");
    setCardName(user?.name || "Test Creator");
    toast.info("Test card details filled!");
  };

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    promoMutation.mutate({ code: promoInput.trim() });
  };

  const handleCopyCrypto = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Wallet address copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      await upgradeMutation.mutateAsync({
        interval,
        method: selectedMethod,
        cardNumber: selectedMethod === "card" ? cardNumber.replace(/\s/g, "") : undefined,
        cardExpiry: selectedMethod === "card" ? cardExpiry : undefined,
        cardCvc: selectedMethod === "card" ? cardCvc : undefined,
        cardName: selectedMethod === "card" ? cardName : undefined,
        promoCode: appliedPromo?.code,
        cryptoTxid: selectedMethod === "crypto" ? cryptoTxid : undefined,
      });
    } catch {
      setIsProcessing(false);
    }
  };

  const handleCloseAll = () => {
    setReceiptData(null);
    onClose();
  };

  const config = paymentConfigQuery.data;
  const isLive = config?.isLive ?? false;

  // Determine card brand
  const cleanCardDigits = cardNumber.replace(/\D/g, "");
  const cardBrand = cleanCardDigits.startsWith("4")
    ? "Visa"
    : cleanCardDigits.startsWith("5")
    ? "Mastercard"
    : cleanCardDigits.startsWith("3")
    ? "Amex"
    : "Card";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleCloseAll}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#e4e5de] bg-[#fdfdfc] text-[#111318] shadow-2xl dark:border-white/10 dark:bg-[#16181f] dark:text-[#f7f7f2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -left-12 -top-12 size-48 rounded-full bg-[#5e5ce6]/25 blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 size-48 rounded-full bg-[#d8ef54]/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleCloseAll}
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/5 text-[#6c6e79] transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {receiptData ? (
          /* Receipt Screen */
          <div className="p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check size={32} strokeWidth={3} />
            </div>

            <h3 className="mt-4 text-2xl font-black tracking-tight">Payment Confirmed!</h3>
            <p className="mt-1 text-sm text-[#686b75] dark:text-[#9ea2b0]">
              Welcome to CBdrop Pro! Your premium benefits are active immediately.
            </p>

            <div className="mt-6 rounded-2xl border border-[#e1e2da] bg-white p-5 text-left text-xs space-y-2.5 dark:border-white/10 dark:bg-white/5">
              <div className="flex justify-between items-center pb-2.5 border-b border-[#e1e2da] dark:border-white/10">
                <span className="text-[#686b75] dark:text-[#9ea2b0]">Receipt ID</span>
                <span className="font-mono font-bold">{receiptData.transactionId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#686b75] dark:text-[#9ea2b0]">Plan</span>
                <span className="font-bold">CBdrop Pro ({receiptData.interval})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#686b75] dark:text-[#9ea2b0]">Amount Paid</span>
                <span className="font-bold text-[#5e5ce6] text-sm">${receiptData.amount} {receiptData.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#686b75] dark:text-[#9ea2b0]">Payment Method</span>
                <span className="font-bold">
                  {receiptData.method} {receiptData.cardLast4 ? `(•••• ${receiptData.cardLast4})` : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#686b75] dark:text-[#9ea2b0]">Date</span>
                <span>{receiptData.date}</span>
              </div>
            </div>

            <button
              onClick={handleCloseAll}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5e5ce6] text-sm font-black text-white shadow-[0_8px_22px_rgba(94,92,230,0.35)] transition hover:bg-[#504ed1] active:scale-[0.98]"
            >
              Continue to CBdrop Pro
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          /* Checkout Screen */
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#5e5ce6] text-white shadow-md shadow-[#5e5ce6]/30">
                  <CreditCard size={20} />
                </span>
                <div>
                  <h3 className="text-xl font-black tracking-[-0.03em]">Secure Checkout</h3>
                  <p className="text-xs text-[#7c7f8a] dark:text-[#9ea1ad]">
                    CBdrop Pro · {interval === "yearly" ? "Annual Plan" : "Monthly Plan"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1.5">
                  {appliedPromo && (
                    <span className="text-sm line-through text-[#868994] dark:text-[#71737e]">
                      ${basePrice}
                    </span>
                  )}
                  <span className="text-2xl font-black text-[#5e5ce6]">${price}</span>
                </div>
                <p className="text-[10px] text-[#868994] dark:text-[#9ea1ad]">
                  {interval === "yearly" ? "/year" : "/month"}
                </p>
              </div>
            </div>

            {/* Gateway Status Badge */}
            <div className="mt-3.5 flex items-center justify-between rounded-xl border border-[#e1e2da] bg-white/60 px-3 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/5">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <span className={`size-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {isLive ? "Live Gateway Active" : "Sandbox Gateway Active"}
              </span>
              <span className="text-[#686b75] dark:text-[#9ea2b0] text-[10px]">
                {isLive ? "Stripe 256-bit SSL" : "Test Mode · Card 4242"}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { id: "card", label: "Credit Card" },
                { id: "paypal", label: "PayPal" },
                { id: "crypto", label: "Crypto" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethod(m.id as any)}
                  className={`flex h-10 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                    selectedMethod === m.id
                      ? "border-[#5e5ce6] bg-[#f2f1ff] text-[#5e5ce6] shadow-xs dark:bg-[#5e5ce6]/20 dark:text-white"
                      : "border-[#dedfd8] bg-white text-[#71737e] hover:border-[#5e5ce6]/40 dark:border-white/10 dark:bg-white/5 dark:text-[#9ea1ad]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Checkout Form */}
            <form onSubmit={handlePay} className="mt-4 space-y-3">
              {selectedMethod === "card" && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#686b75] dark:text-[#9ea1ad]">
                      Card Details {cardBrand !== "Card" && `(${cardBrand})`}
                    </label>
                    <button
                      type="button"
                      onClick={handleFillTestCard}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5e5ce6] hover:underline"
                    >
                      <Sparkles size={11} /> Fill Test Card (4242)
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="Card Number (4242 •••• •••• 4242)"
                      className="h-11 w-full rounded-xl border border-[#dedfd8] bg-white px-3.5 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={cardExpiry}
                      onChange={handleExpiryChange}
                      placeholder="MM / YY"
                      className="h-11 w-full rounded-xl border border-[#dedfd8] bg-white px-3.5 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                    <input
                      type="text"
                      required
                      value={cardCvc}
                      onChange={handleCvcChange}
                      placeholder="CVC / CVV"
                      className="h-11 w-full rounded-xl border border-[#dedfd8] bg-white px-3.5 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#686b75] dark:text-[#9ea1ad]">Name on Card</label>
                    <input
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Cardholder Name"
                      className="mt-1 h-11 w-full rounded-xl border border-[#dedfd8] bg-white px-3.5 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                  </div>
                </>
              )}

              {selectedMethod === "paypal" && (
                <div className="rounded-2xl border border-[#dfe0d8] bg-[#fbfbf8] p-5 text-center dark:border-white/10 dark:bg-white/5 space-y-2">
                  <div className="inline-flex size-10 items-center justify-center rounded-full bg-[#003087]/15 text-[#003087] dark:text-[#0079C1]">
                    <ShieldCheck size={20} />
                  </div>
                  <p className="text-xs font-bold">PayPal Fast Checkout</p>
                  <p className="text-[11px] text-[#71737e] dark:text-[#9ea1ad]">
                    Authorize your ${price} subscription with PayPal balance, connected cards, or Pay in 4.
                  </p>
                  <p className="text-[10px] text-[#868994] font-mono">Recipient: {config?.paypalEmail || "payments@cbdrop.com"}</p>
                </div>
              )}

              {selectedMethod === "crypto" && (
                <div className="rounded-2xl border border-[#dfe0d8] bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/5 space-y-3">
                  <div className="flex gap-1.5 justify-center">
                    {(["usdtTrc20", "btc", "eth"] as const).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setSelectedCrypto(curr)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition ${
                          selectedCrypto === curr
                            ? "bg-[#5e5ce6] text-white"
                            : "bg-white text-[#686b75] hover:bg-gray-100 dark:bg-white/10 dark:text-gray-300"
                        }`}
                      >
                        {curr === "usdtTrc20" ? "USDT (TRC20)" : curr}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[#e1e2da] bg-white p-2.5 dark:border-white/10 dark:bg-black/30">
                    <p className="text-[10px] text-[#686b75] dark:text-[#9ea2b0] font-bold">
                      Send ${price} USD equivalent to:
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] break-all select-all">
                        {config?.cryptoAddresses[selectedCrypto] || "TXvG9rN5B8w8F1zXk4Yq7eL3mA9pC2dE1f"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyCrypto(config?.cryptoAddresses[selectedCrypto] || "TXvG9rN5B8w8F1zXk4Yq7eL3mA9pC2dE1f")
                        }
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-black/5 text-[#5e5ce6] hover:bg-black/10 dark:bg-white/10"
                        title="Copy address"
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={cryptoTxid}
                      onChange={(e) => setCryptoTxid(e.target.value)}
                      placeholder="Transaction Hash / TXID (Optional)"
                      className="h-10 w-full rounded-xl border border-[#dedfd8] bg-white px-3 text-xs outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                  </div>
                </div>
              )}

              {/* Promo Code Section */}
              <div className="pt-1">
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <Tag size={13} />
                      {appliedPromo.code} ({appliedPromo.discountPercent}% OFF)
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppliedPromo(null)}
                      className="text-emerald-700/60 hover:text-emerald-700 dark:text-emerald-300/60"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Promo Code (try CBDROP50)"
                      className="h-9 flex-1 rounded-xl border border-[#dedfd8] bg-white px-3 text-xs outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoMutation.isPending || !promoInput.trim()}
                      className="rounded-xl border border-[#dedfd8] bg-white px-3 text-xs font-bold text-[#5e5ce6] hover:bg-[#f2f1ff] disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
                    >
                      {promoMutation.isPending ? "Applying..." : "Apply"}
                    </button>
                  </div>
                )}
              </div>

              {/* Pay Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5e5ce6] text-xs font-black text-white shadow-[0_8px_22px_rgba(94,92,230,0.35)] transition hover:bg-[#504ed1] active:scale-[0.98] disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Authorizing Payment...</span>
                  </>
                ) : (
                  <>
                    <Lock size={13} />
                    <span>Pay ${price} & Activate Pro</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Security Assurance */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-[#7d808c] dark:text-[#9ea1ad]">
              <ShieldCheck size={14} className="text-[#65ab37]" />
              <span>256-bit encrypted · Cancel anytime · Instant access</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
