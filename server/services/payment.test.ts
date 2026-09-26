import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidCardNumber,
  processPayment,
  getPaymentGatewayConfig,
  ACTIVE_PROMO_CODES,
} from "./payment";
import { store } from "../store";

describe("Payment Gateway Service", () => {
  let testUserId: number;

  beforeEach(() => {
    let user = store.getUserByEmail("testpay@cbdrop.com");
    if (!user) {
      user = store.createUser({
        name: "Payment Tester",
        email: "testpay@cbdrop.com",
        password: "password123",
        plan: "free",
      });
    }
    testUserId = user.id;
  });

  describe("Card validation (Luhn algorithm)", () => {
    it("validates standard test card 4242 4242 4242 4242", () => {
      expect(isValidCardNumber("4242424242424242")).toBe(true);
      expect(isValidCardNumber("4242 4242 4242 4242")).toBe(true);
    });

    it("rejects invalid card numbers", () => {
      expect(isValidCardNumber("1234567890123456")).toBe(false);
      expect(isValidCardNumber("123")).toBe(false);
      expect(isValidCardNumber("")).toBe(false);
    });
  });

  describe("Gateway Configuration", () => {
    it("returns supported payment methods and addresses", () => {
      const config = getPaymentGatewayConfig();
      expect(config.supportedMethods).toContain("card");
      expect(config.supportedMethods).toContain("paypal");
      expect(config.supportedMethods).toContain("crypto");
      expect(config.cryptoAddresses.usdtTrc20).toBeDefined();
    });
  });

  describe("Payment Processing", () => {
    it("processes a monthly card payment and upgrades user to pro", async () => {
      const result = await processPayment({
        userId: testUserId,
        interval: "monthly",
        method: "card",
        cardNumber: "4242424242424242",
        cardExpiry: "12/28",
        cardCvc: "888",
        cardName: "Payment Tester",
      });

      expect(result.success).toBe(true);
      expect(result.payment.amount).toBe(4.99);
      expect(result.receipt.amount).toBe(4.99);
      expect(result.receipt.interval).toBe("Monthly");
      expect(result.receipt.transactionId).toBeDefined();

      const user = store.getUserById(testUserId);
      expect(user?.plan).toBe("pro");
    });

    it("processes an annual payment with 50% promo code (CBDROP50)", async () => {
      const result = await processPayment({
        userId: testUserId,
        interval: "yearly",
        method: "card",
        cardNumber: "4242424242424242",
        promoCode: "CBDROP50",
      });

      expect(result.success).toBe(true);
      // 29 * 0.5 = 14.50
      expect(result.payment.amount).toBe(14.5);
      expect(result.receipt.amount).toBe(14.5);
      expect(result.receipt.interval).toBe("Annual");
    });

    it("processes PayPal payment selection", async () => {
      const result = await processPayment({
        userId: testUserId,
        interval: "monthly",
        method: "paypal",
      });

      expect(result.success).toBe(true);
      expect(result.receipt.method).toBe("PAYPAL");
    });

    it("processes Crypto payment with TXID", async () => {
      const result = await processPayment({
        userId: testUserId,
        interval: "yearly",
        method: "crypto",
        cryptoTxid: "0x123456789abcdef",
      });

      expect(result.success).toBe(true);
      expect(result.receipt.method).toBe("CRYPTO");
    });
  });
});
