# ISGPay UAT Integration — Phase 1

Status: **backend modules and offline tests only.** No route, no checkout UI, no database writes, no network calls in tests, and no UAT transaction has been run. Nothing here is gateway-certified.

Branch: `feat/isgpay-integration-uat`.

## 1. Sources and precedence

| Source | Used for |
| --- | --- |
| **ISGPay NG Redirection Non-PCI API Spec v1.6** (`…v1.6 New.pdf`) | Primary authority: fields, hash, EncData format, endpoints, response codes |
| Merchant onboarding email (values held in the local `.env`) | Merchant credentials, MCC, UAT URLs |
| YesBankPG Node kit (2019): `Utility.js`, `app.js`, `config.js`, views | AES mode/padding/key bytes, status wire format (legacy evidence only) |
| `ISG PAY_Integration Document_V1.1.docx` (2017, bundled in the kit) | Legacy background: "form POST" transport, old response codes |

Where they conflict, v1.6 and the merchant email take precedence over the kit and the docx.

> ⚠ The v1.6 PDF's §8.1 "Merchant Credentials" table holds **this merchant's real UAT credentials**: MID and encryption key match `.env`. Treat the PDF as a secret-bearing document. Do not paste §8.1 into tickets, docs or chats.

## 2. Files

Added (nothing existing was modified apart from `.env.example`):

| File | Purpose |
| --- | --- |
| `api/_lib/isgpay-config.ts` | Env loading and validation, pinned endpoints, feature flag, secret container |
| `api/_lib/isgpay-crypto.ts` | SecureHash, EncData serialize/parse, AES encrypt/decrypt, envelope verification |
| `api/_lib/isgpay.ts` | TxnRefNo, INR→paise, sale handoff, status query client, transaction evaluation |
| `api/_lib/isgpay-test-fixture.ts` | Synthetic env fixture for tests |
| `api/_lib/isgpay-config.test.ts`, `isgpay-crypto.test.ts`, `isgpay.test.ts` | 177 tests |
| `.env.example` | ISGPay section, blank secrets |
| `docs/ISGPAY-UAT-PHASE1.md` | This document |

**Not touched:** every Airpay file (`config.ts`, `airpay.ts`, `airpay-crypto.ts`, `settle.ts`, `db.ts`, `order-ref.ts`, callbacks, relay), `api/payments/*`, `api/orders/*`, `vercel.json`, `src/`, `supabase/`, `.env`, `.env.local`.

## 3. Architecture

```
isgpay-config.ts   process.env → IsgpayConfig (validated, secrets in private fields)
       │
isgpay-crypto.ts   pure functions; secrets passed in; no env, no I/O, no logging
       │
isgpay.ts          buildSaleRequest / querySaleStatus / parseStatusBody / evaluateTransaction
                   (no DB, no settlement: answers "is this VERIFIED record eligible?")
```

- The only coupling to existing code is reuse of `ConfigError` (config.ts) and `logEvent` (log.ts). Neither was changed.
- `VerifiedIsgpayFields` is a branded type. `evaluateTransaction` accepts only records that went through SecureHash verification, so an unverified callback can't reach it by accident.
- Env loading: nothing in `api/` loads `.env`. Vercel injects project variables, `vercel dev` reads `.env`, and Vitest exposes only `VITE_*` (to `import.meta.env`). Config is read from `process.env` per call, and tests install a synthetic fixture.

## 4. Environment variables

| Variable | Rule | Notes |
| --- | --- | --- |
| `ISGPAY_ENABLED` | `true` \| `false` (blank = false; anything else rejected) | Gates **new initiation** only |
| `ISGPAY_ENV` | `uat` only | Production is rejected until its host is confirmed |
| `ISGPAY_BANK_ID` | 6 alphanumeric | Kept as a string; leading zeros preserved |
| `ISGPAY_MERCHANT_ID` | 1–16 alphanumeric | |
| `ISGPAY_TERMINAL_ID` | 8 alphanumeric | |
| `ISGPAY_MCC` | 4 digits | Use the email's value (see §11) |
| `ISGPAY_PASSCODE` | 8 alphanumeric | Secret; travels only inside EncData or the status POST body |
| `ISGPAY_SECURE_SECRET` | 16–128 alphanumeric | Secret (hash salt) |
| `ISGPAY_ENC_KEY` | exactly 32 printable ASCII | Secret; its bytes are the AES-256 key |
| `ISGPAY_CURRENCY` | `356` | INR only |
| `ISGPAY_SALE_URL` | must equal the pinned UAT sale URL | Never caller-chosen |
| `ISGPAY_STATUS_URL` | must equal the pinned UAT status URL | |
| `ISGPAY_RETURN_URL` | https, host `authenticmedia.fun` / `www.`, ≤255, no `\|` or `::` | Required |
| `ISGPAY_CALLBACK_URL` | same rules; must not be the Airpay callback path | Optional; registered with ISGPay out of band |

`.env` also has `ISGPAY_REFUND_URL` and `ISGPAY_REFUND_STATUS_URL`. Phase 1 doesn't read them.

Errors name the variable, never its value. `IsgpaySecrets` keeps the three secrets in `#private` fields, so `JSON.stringify`, `util.inspect` and spreading a config show no secret (tested).

## 5. Endpoints (pinned)

| Env | Sale | Status |
| --- | --- | --- |
| `uat` | `https://sandbox.isgpay.com/ISGPay-Genius/request.action` | `https://sandbox.isgpay.com/ISGPay-Genius/Status` |
| production | **UNCONFIRMED.** v1.6 §8.4 gives only `https://<domain>/ISGPay-Genius/…` | refused |

Rejected (tested): the legacy `:8443/ISGPay/` paths, `isgpay.com` while in UAT, `http:`, look-alike hosts, query strings. Status requests use `redirect: 'error'`.

## 6. SecureHash: **CONFIRMED**

```
SecureHash = lowercase_hex( SHA-256( SECURE_SECRET + value₁ + value₂ + … ) )
```

- Values of every field except `SecureHash`, ordered by **ascending ASCII field name** (`Card` < `CardNum` < `card`). JS default `sort()` compares UTF-16 code units, which is the same thing for ASCII.
- No separators. Plain SHA-256, **not HMAC**.
- Empty fields are omitted (kit). An empty value adds `""` to the input, so omitting it can't change the digest.
- Verification checks the 64-hex format, then compares with `timingSafeEqual`. Hex case is ignored.

Known-answer vectors (in tests):

| Vector | Result |
| --- | --- |
| v1.6 §4 published example: secret `0F5DD1…F6F0` + `2995MER123Order456` | `f43c85ac…be287b` ✅ reproduced exactly |
| Full synthetic sale field set | `a1805797…901d93`. Kit `generateSecurehash` ✅, coreutils `sha256sum` ✅, our code ✅ |
| 2017 docx example | ❌ does not reproduce under plain, hex-pre-encoded or upper-case variants. The docx predates v1.6; treated as legacy noise |

On responses, the hash is checked over the raw values first, then once over URL-decoded values (`+`→space), because the kit decodes before hashing and v1.6 doesn't say which form the gateway signs (**UNCONFIRMED**). Both variants need the secret. `hashOver` records which one matched.

## 7. EncData

### Plaintext: **CONFIRMED format**

`Name||Value::Name||Value` (v1.6 §3.1.1 and §5; rev 1.5 changed it "from json to pipe separate"). The spaces in the §5 sample (`MerchantId ||1000…:: TerminalId`) are typesetting: the text says "must not have any separators", so none are emitted.

- Order: any (§5). The builder uses the v1.6 table order with `SecureHash` last. Hash order and serialization order are separate code paths.
- Rejected on serialize: duplicate names, names not matching `^[A-Za-z][A-Za-z0-9]{0,63}$`, values containing `|`, `::`, a trailing `:` (it would merge into the next `::`), or control characters. URLs (`https://`) are fine.
- Parse is strict: each part must split on `||` into exactly two pieces. Duplicates, stray `|`, empty names and control characters all return `null`. Empty values are kept as `""`.

### AES: **UNCONFIRMED against the gateway**

v1.6 says only "AES-256". From the kit's `Utility.js`:

| Property | Value | Evidence |
| --- | --- | --- |
| Cipher | AES-256-**ECB** (no IV) | `createCipheriv("aes-256-ecb", EncKey, '')` |
| Padding | PKCS#7 | Node default; kit never disables it |
| Key bytes | **the 32-character string's own UTF-8 bytes** | kit passes the string; hex-decoding would give 16 bytes, which AES-256 refuses (`ERR_CRYPTO_INVALID_KEYLEN`, verified) |
| Output | standard Base64 | `cipher.update(…,'base64')` |

Offline vector: kit `encrypt_aes` and `openssl enc -aes-256-ecb -K <hex of key bytes> -nosalt -base64` produce the **identical** ciphertext for the same synthetic key and plaintext, and our `encryptEncData` matches both. This proves we match the kit. It doesn't prove the gateway accepts it. The docx's sample ciphertext can't be checked because its key isn't published.

`decryptEncData` never throws. It returns `null` for non-canonical Base64 (including URL-safe characters, or spaces where `+` was form-decoded), lengths that aren't a block multiple, bad padding, a wrong key, or invalid UTF-8.

Security notes: ECB leaks equal-block patterns and has no integrity of its own. It's mandated for compatibility. Integrity comes from the SecureHash inside the plaintext, and trust (in later phases) comes only from a verified Status Query.

## 8. Sale request (`buildSaleRequest`)

Requires `ISGPAY_ENABLED=true`. EncData fields:

| Field | Value | Source |
| --- | --- | --- |
| BankId, MerchantId, TerminalId, MCC, PassCode | config | v1.6 §3.1.1 (Required) |
| TxnRefNo | `generateTxnRefNo()` | Required, alphanumeric 1–40 |
| TxnType | `Pay` | Required; glossary "Purchase-Pay" |
| Currency | `356` | Required |
| Amount | paise string | Required, 1–12 digits |
| ReturnURL | config | Required |
| Command | `Pay` | Required; §9 "Constant value as Pay". `Pay+TP` is tokenisation only |
| OrderInfo | optional, `^[A-Za-z0-9]{1,40}$` | Optional |
| SecureHash | §6 | Required |

**Deliberately absent:** `CardNumber`, `ExpiryDate`, `CardSecurityCode`, all token/ALT-ID fields (non-PCI hosted page), `payOpt` (for a 3-party merchant it would restrict the hosted page to one method), `Version` (in the kit but in no v1.6 table, **UNCONFIRMED**), and customer/UDF fields (lengths are unclear in the extracted tables, so they're deferred).

Handoff returned (`SaleHandoff`): `action` (the pinned sale URL), `fields: { MerchantId, TerminalId, BankId, EncData }`, plus internal `txnRefNo` and `amountPaise`. PassCode and SecureHash exist only inside EncData. A test asserts that the serialized handoff contains no secret.

**TxnRefNo:** `ISG` + 8 base36 time chars + 16 hex chars from `randomBytes(8)` (64 bits), upper-case, 27 chars, `^ISG[0-9A-Z]{8}[0-9A-F]{16}$`. There's no hyphen because v1.6 says "Alpha-Numeric" and has an "invalid characters" error (VERORDID04). It can't collide with Airpay's `AM-`/`AM2-` format (tested). `order-ref.ts` is unchanged.

**Amount:** `inrToPaise` parses the decimal **string** (`String(number)` gives the shortest round-trip form) and computes with BigInt, so there's no float multiplication (`1.15 → 115`, `0.29 → 29`). It rejects >2 decimals, ≤0, exponents, separators, symbols, signs and >12 digits. `amountsMatch` does exact BigInt equality.

## 9. Sale Status Query (`querySaleStatus`)

- Request fields (v1.6 §3.2.1): `BankId, MerchantId, TerminalId, TxnRefNo, PassCode, TxnType=Status, MCC, SecureHash`, sent in **plain form, not EncData**. The status table lists no EncData, unlike the sale table.
- **Transport: UNCONFIRMED.** v1.6 says only "HTTP-POST". The kit POSTs with all params in the **URL query string** and `Content-Type: application/json`. We send `application/x-www-form-urlencoded` in the **body** (docx §2.5 "form POST"), which also keeps PassCode and SecureHash out of URLs and access logs. If UAT rejects this, change `querySaleStatus` in one place.
- **Response format: UNCONFIRMED.** The kit parses `k=v&k=v` with URL decoding, and that's what we accept. If the pairs carry an `EncData` and no `ResponseCode`, the envelope is opened and verified like a sale response. JSON, HTML, plain text, duplicate keys, a missing hash or a bad hash all come back `inconclusive`.
- 8 s `AbortController` timeout, no retries, never throws. Timeouts, transport errors, non-2xx responses (even with a successful-looking body), empty or unrecognized bodies and hash mismatches are all `inconclusive`, never success.
- Logs one `isgpay.status_query` event with `txnRefNo`, `result`, `reason` and `httpStatus`. No field values, hashes, bodies or secrets (tested).

Kit bug, not reproduced: its status request uses `result.slice(0, -2)` on an `&`-joined string, which removes the `&` **and the last hex character of SecureHash**.

## 10. Transaction validation (`evaluateTransaction`)

Input: a **verified** record, plus the server's own `{ txnRefNo, amountPaise }`.

| Check | Failure outcome |
| --- | --- |
| MerchantId, TerminalId, BankId equal config | `mismatch` (merchant / terminal / bank) |
| TxnRefNo equals expected | `mismatch: txn_ref` |
| Currency, if present, is `356` | `mismatch: currency` |
| Amount, if present, exactly equals expected paise | `mismatch: amount` |
| ResponseCode present | `unverifiable: response_code_absent` |
| ResponseCode is exactly `00` | `not_success` (with the code) |
| Amount present when the code is `00` (it's Optional in §3.2.2) | `unverifiable: amount_absent` |

Only `success` is eligible for settlement. `not_success` is **not** a terminal failure: the decline policy is a Phase 2 decision, kept fail-closed in both directions. The legacy docx's success code `0` is **not** success.

## 11. Legacy kit (2019) vs v1.6

| Topic | Kit / 2017 docx | v1.6 / email | Phase 1 choice |
| --- | --- | --- | --- |
| Endpoints | `sandbox.isgpay.com:8443/ISGPay/…` | `sandbox.isgpay.com/ISGPay-Genius/…` | v1.6 (pinned) |
| `Version` field | sent (`1`) outer + EncData | not listed | omitted (UNCONFIRMED) |
| `Command` | not sent | Required (`Pay`) | sent |
| EncData field order | sorted | any order | table order |
| Card fields in request | merchant form collects PAN/CVV | non-PCI: hosted page only | never sent |
| Success code | docx `0` | `00` | `00` only |
| AES mode/key | ECB, key string bytes | "AES-256" only | kit behaviour (UNCONFIRMED) |
| Status transport | POST, query string, JSON content-type | POST | form body (UNCONFIRMED) |
| Response hash input | URL-decoded values | unspecified | raw, then decoded |
| Logging | logs plaintext, hash input with secret | — | names/categories only |
| Credentials | hard-coded sample values in `config.js` | env | env only; nothing copied |
| Status request | truncates SecureHash (`slice(0,-2)`) | — | not reproduced |
| MCC | — | PDF §8.1 sample `5111`; email `4112` | env value (`4112`), as instructed |

A separate local project (`firnviaNew`) holds an earlier ISGPay implementation. It reaches the same choices and also marks status transport/format UNCONFIRMED. It's corroboration, not proof. No code was copied.

## 12. Open questions for ISGPay

1. AES mode, padding and key encoding for `/ISGPay-Genius/`. Is it still ECB/PKCS#7 with the key's ASCII bytes?
2. Status Query: body or query string? Which content type? Is the response `k=v&…`, EncData, or something else? Is the response hash over raw or URL-decoded values?
3. Is `Version` required or accepted on `/ISGPay-Genius/`?
4. Is `Command` case-sensitive (`Pay` vs the `PAY` in the scenarios table)?
5. Is `-` allowed in TxnRefNo? (We avoid it.)
6. Production host for sale/status/refund.
7. MCC: confirm `4112` (email) over the PDF's `5111`.
8. Push-callback acknowledgement wire format (§3.6.2 lists `Acknowledgement` = "Received" but not the encoding).
9. Which response codes are terminal declines and which are retryable/pending?
10. Is `Amount` always present in Status responses for successful sales?

## 13. Phase 2 (before checkout)

- Routes: `POST /api/payments/isgpay/return` (browser return) and `/api/payments/isgpay/callback` (push; ack format per Q8). Both only `openGatewayResponse` → **trigger** a Status Query. Neither settles on its own.
- Settlement through the existing single-settlement discipline: a verified Status `success` plus the server-computed amount → paid; `mismatch` → `requires_review`; `inconclusive`/`unverifiable` → stays pending. A schema/migration is needed for ISGPay order rows (gateway column, TxnRefNo). It must not reuse Airpay settlement code paths unreviewed.
- Reconciliation sweep for ISGPay pending orders, plus a bounded retry policy for status.
- Never forward ISGPay callbacks to the Airpay/KKChat relay.
- Form-POST body parsing: make sure Base64 `+` survives URL-decoding on the return/callback routes.
- Checkout option behind `ISGPAY_ENABLED`, with the server computing the amount (`inrToPaise`) from the catalogue and never from the client.
- UAT readiness: answers to Q1–Q2 at minimum, then one supervised UAT sale with test cards, checking hash and decryption on the real response before anything else is built on it.
