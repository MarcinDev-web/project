# ADR: WASM collision acceleration (Rust + Worker)

- Status: Accepted
- Date: 2025-10-26

## Kontekst
Tryb placement wymaga wielu sprawdzeń kolizji (OBB vs OBB). Implementacja TS jest poprawna, ale kosztowna przy większej liczbie kandydatów.

## Decyzja
- Offload krytycznych fragmentów do Rust/WASM:
  - SAT OBB vs OBB (15 osi)
  - Batch API (SoA) + broad-phase wewnątrz Rust
- Dwa tryby:
  - In-thread WASM (bez zmiany API synchronicznego)
  - Worker (asynchroniczny) – warm-up i kolejka z AbortSignal
- Zachowujemy fallback TS i zgodność wyników (parity tests).

## Szczegóły techniczne
- `batch_check_trs_linear` – baza bez siatki
- `batch_check_trs` – siatka jednorodna (uniform grid) jako broad-phase
- TS wrapper: TRS SoA, opcjonalne subarray, pula buforów
- Editor: próg wyboru ścieżki (TS <64, WASM ≥64), logi perf za flagą `__COLLISION_DEBUG__`
- Worker: kolejka żądań, timeouts, anulowanie przez AbortSignal

## Alternatywy
- Sweep-and-prune – potencjalnie lepsze dla silnie uporządkowanych scen, ale wyższa złożoność stanu
- BVH – lepsze dla statycznych scen, gorsze dla ciągłych zmian TRS

## Konsekwencje
- Złożoność buildów (Rust, wasm-pack) i CI (benchmarks)
- Zysk wydajności: oczekiwanie ≥3x dla 1k kandydatów (w praktyce zależne od sceny)

## Testy
- Jednostkowe (Rust)
- Parity (TS vs WASM) – losowe TRS, property-based
- Smoke (Worker) – węzeł pomija
