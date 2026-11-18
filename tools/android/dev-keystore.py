#!/usr/bin/env python3
"""Stable signing key for SnapMon's private DEVELOPMENT APKs, derived from one secret passphrase.

Why: Android only installs an update over an existing app if both are signed with the SAME certificate. Every GitHub
Actions runner would otherwise create its own throw-away debug key, so each new APK would refuse to update the last
one ("App not installed") and the only way forward would be uninstalling — which deletes the saved progress.

How: the RSA-2048 key is generated deterministically from the passphrase (HMAC-SHA256 stream → primes, plain Python
integers, no library-version-dependent randomness), and the self-signed certificate has fixed fields and a
deterministic PKCS#1 v1.5 signature. The same passphrase therefore always yields byte-identical certificates; the
printed SHA-256 fingerprint must stay the same from build to build.

The passphrase lives ONLY in the repository secret ANDROID_DEV_SIGNING_SEED. No key file is ever committed or uploaded;
the keystore exists only inside the CI job (deleted at the end). Anyone with the passphrase can sign APKs that update
the dev app, so keep it private (a password manager). This key is for the development app only (…snapmon.dev); Google
Play releases use a separate upload key and Play App Signing (docs/ANDROID.md).

Usage: SEED=… python3 tools/android/dev-keystore.py <out.p12> <keystore-password>   (reads the seed from $SEED)
Prints the certificate's SHA-256 fingerprint. Requires: pip install cryptography (pinned in the workflow).
"""
import datetime, hashlib, hmac, os, sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

ALIAS = b"snapmon-dev"
DOMAIN = b"snapmon-dev-signing-v1"   # never change: it would change the derived key (and break updates)
SMALL_PRIMES = [p for p in range(3, 2000) if all(p % d for d in range(2, int(p ** 0.5) + 1))]


def stream(key: bytes, label: bytes, n: int) -> bytes:
    out, i = b"", 0
    while len(out) < n:
        out += hmac.new(key, label + b"|" + i.to_bytes(4, "big"), hashlib.sha256).digest()
        i += 1
    return out[:n]


def probable_prime(n: int, key: bytes, label: bytes) -> bool:
    if any(n % p == 0 for p in SMALL_PRIMES):
        return n in SMALL_PRIMES
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for k in range(40):  # 40 Miller–Rabin rounds with bases derived from the seed: error < 2^-80
        a = 2 + int.from_bytes(stream(key, label + b"|mr|" + str(k).encode(), 160), "big") % (n - 3)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def prime(key: bytes, label: bytes, bits: int, e: int) -> int:
    c = int.from_bytes(stream(key, label, bits // 8), "big") | (3 << (bits - 2)) | 1  # top two bits: n has full length
    while not (probable_prime(c, key, label) and (c - 1) % e != 0):
        c += 2
    return c


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    seed = os.environ.get("SEED", "")
    if len(seed) < 24:
        sys.exit("SEED must be a secret passphrase of at least 24 characters")
    key = hmac.new(DOMAIN, seed.encode("utf-8"), hashlib.sha256).digest()
    e = 65537
    p, q = prime(key, b"p", 1024, e), prime(key, b"q", 1024, e)
    if p == q:
        sys.exit("degenerate key")
    if p < q:
        p, q = q, p
    n, d = p * q, pow(e, -1, (p - 1) * (q - 1))
    priv = rsa.RSAPrivateNumbers(p, q, d, rsa.rsa_crt_dmp1(d, p), rsa.rsa_crt_dmq1(d, q), rsa.rsa_crt_iqmp(p, q),
                                 rsa.RSAPublicNumbers(e, n)).private_key()
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "SnapMon Development"),
                      x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SnapMon")])
    serial = int.from_bytes(stream(key, b"serial", 16), "big") >> 1 or 1
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(priv.public_key())
            .serial_number(serial)
            .not_valid_before(datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc))
            .not_valid_after(datetime.datetime(2076, 1, 1, tzinfo=datetime.timezone.utc))
            .sign(priv, hashes.SHA256()))  # RSA default: PKCS#1 v1.5, deterministic
    out, password = sys.argv[1], sys.argv[2].encode("utf-8")
    with open(out, "wb") as f:
        f.write(pkcs12.serialize_key_and_certificates(ALIAS, priv, cert, None, serialization.BestAvailableEncryption(password)))
    os.chmod(out, 0o600)
    fp = cert.fingerprint(hashes.SHA256()).hex(":").upper()
    print(f"dev signing certificate SHA-256: {fp}")


if __name__ == "__main__":
    main()
