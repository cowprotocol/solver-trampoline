# Solver Trampoline

The `SolverTrampoline` contract is a thin settlement wrapper contract that
executes settlements authenticated by signature instead of `msg.sender`. This
allows for permission-less settlement transaction execution whereby a solver
signs settlement calldata, but any account can execute it.

In particular, this is useful for executing settlement with transaction relay
networks (such as the Gelato relay network and Infura ITX) without any
additional trust assumptions about the transaction executor.

## Transaction Flow

```mermaid
sequenceDiagram

    participant Relayer
    participant SolverTrampoline
    participant GPv2Settlement
    participant GPv2Authentication
    
    Relayer->>+SolverTrampoline: settle(calldata, signature)
    SolverTrampoline->>SolverTrampoline: ecrecover(calldata, signature)
    SolverTrampoline->>+GPv2Authentication: isSolver(recoveredSigner)
    GPv2Authentication-->>-SolverTrampoline: true/false
    opt not a signer
        SolverTrampoline-->>Relayer: revert()
    end
    SolverTrampoline->>+GPv2Settlement: settle(calldata)
    GPv2Settlement->>+GPv2Authentication: isSolver(SolverTrampoline)
    GPv2Authentication-->>-GPv2Settlement: true
    GPv2Settlement->>GPv2Settlement: settlement execution
    GPv2Settlement-->>-SolverTrampoline: result
    SolverTrampoline-->>-Relayer: result
```
