import assert from "assert";
import {
  areEquivalentWhatsAppNumbers,
  canonicalWhatsAppIdentity,
  digitsOnly
} from "../src/utils/phoneNumber";

function run(): void {
  assert.strictEqual(digitsOnly("+55 (85) 98801-8899"), "5585988018899");
  assert.strictEqual(canonicalWhatsAppIdentity("5585988018899"), "558588018899");
  assert.strictEqual(canonicalWhatsAppIdentity("558588018899"), "558588018899");

  assert.strictEqual(areEquivalentWhatsAppNumbers("5585988018899", "558588018899"), true);
  assert.strictEqual(areEquivalentWhatsAppNumbers("+55 85 98801-8899", "55 85 8801-8899"), true);
  assert.strictEqual(areEquivalentWhatsAppNumbers("5585988018899", "558588018898"), false);
  assert.strictEqual(areEquivalentWhatsAppNumbers("5585988018899", "558688018899"), false);
  assert.strictEqual(areEquivalentWhatsAppNumbers("", ""), false);
  assert.strictEqual(areEquivalentWhatsAppNumbers("14155552671", "14155552671"), true);
  assert.strictEqual(areEquivalentWhatsAppNumbers("14155552671", "14155552672"), false);

  console.log("WhatsApp phone identity tests passed.");
}

try {
  run();
} catch (error) {
  console.error("WhatsApp phone identity tests failed:", error);
  process.exit(1);
}
